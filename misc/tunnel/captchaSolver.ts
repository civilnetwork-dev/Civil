/**
 * Reads a FreeDNS securimage captcha with an OCR model, so the tunnel can open
 * a subdomain without a human typing the code.
 *
 * ## The model
 *
 * A CRNN (CNN → BiLSTM → CTC) — reused, not built here. Its source was
 * `taigzz/freednscaptcha` on Docker Hub (a Flask API wrapping a real trained
 * PyTorch checkpoint), pulled by fetching only the small application-code
 * layer directly from the registry (~33MB) rather than the full ~2.9GB image
 * — the manifest showed the layer sizes, and `pip install torch torchvision`
 * was obviously the huge one. `misc/tunnel/models/freednscaptcha.onnx` is
 * that checkpoint's `torch.onnx.export`, verified to match the original
 * PyTorch output to within 1e-5, and then verified for real: five fresh
 * captchas, each guessed and actually submitted to FreeDNS, five accepted.
 * That is a materially different result from every model tried before it
 * (a stock captcha-TrOCR model, and two general scene-text models — PARSeq
 * and a 275k-real-captcha CRNN — all failed against FreeDNS's specific font).
 *
 * No model card or license accompanies the source image; `taigzz` published
 * it as a runnable public API, which is the use this puts it to.
 *
 * Small enough (35MB) to commit directly rather than stream from a hub on
 * every cold start, unlike the ~300MB model this replaced.
 *
 * ## Why CTC, one forward pass
 *
 * The model predicts one class per output timestep directly — no
 * autoregressive decode loop, no KV cache, just argmax-per-timestep with
 * repeats collapsed and blanks dropped (`ctcGreedyDecode`). Confirmed against
 * the original `ctc_greedy_decode` in the source `model.py`.
 *
 * ## The real charset
 *
 * `CHARS` below (`A`-`Z`, no digits, no lowercase) is the source model's own
 * training charset — independent confirmation, from someone else's labeled
 * data, of what this project's own synthetic-captcha investigation found the
 * hard way: FreeDNS's real answers are uppercase letters only.
 */

import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import * as ort from "onnxruntime-node";
import sharp from "sharp";

const MODEL_PATH =
    process.env.CIVIL_CAPTCHA_MODEL_PATH ??
    join(import.meta.dirname, "models", "freednscaptcha.onnx");

/** The source model's own training charset — CTC class 0 is the blank,
 *  classes 1-26 are `CHARS[0..25]`. */
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** Matches `T.Resize((80, 215))` in the source `app.py` exactly. */
const IMAGE_HEIGHT = 80;
const IMAGE_WIDTH = 215;

let sessionPromise: Promise<ort.InferenceSession> | undefined;

function loadModel(): Promise<ort.InferenceSession> {
    sessionPromise ??= ort.InferenceSession.create(MODEL_PATH);
    return sessionPromise;
}

/** Captcha image bytes → the model's `[1, 1, 80, 215]` tensor. A plain
 *  stretch-resize and a 0-1 scale, no letterboxing and no mean/std — matches
 *  the source `app.py` preprocessing (`Grayscale, Resize((80,215)),
 *  ToTensor()`) exactly, not a guess at what a captcha model usually wants. */
async function toPixelValues(image: Uint8Array): Promise<ort.Tensor> {
    const raw = await sharp(image)
        .greyscale()
        .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "fill" })
        .raw()
        .toBuffer();

    const plane = IMAGE_WIDTH * IMAGE_HEIGHT;
    const data = new Float32Array(plane);
    for (let i = 0; i < plane; i++) data[i] = raw[i]! / 255;
    return new ort.Tensor("float32", data, [1, 1, IMAGE_HEIGHT, IMAGE_WIDTH]);
}

/** Greedy CTC decode: argmax each timestep, collapse repeats, drop blanks
 *  (class 0). Direct port of the source model.py's `ctc_greedy_decode`. */
function ctcGreedyDecode(logits: ort.Tensor): string {
    const [, steps, numClasses] = logits.dims as [number, number, number];
    const data = logits.data as Float32Array;

    let result = "";
    let prev = -1;
    for (let t = 0; t < steps; t++) {
        let best = 0;
        let bestValue = Number.NEGATIVE_INFINITY;
        for (let c = 0; c < numClasses; c++) {
            const value = data[t * numClasses + c]!;
            if (value > bestValue) {
                bestValue = value;
                best = c;
            }
        }
        if (best !== 0 && best !== prev) result += CHARS[best - 1];
        prev = best;
    }
    return result;
}

/**
 * Returns a solver: captcha image bytes → best-guess text. The model loads
 * from the local ONNX file on the first call and is reused after — no
 * network fetch, unlike the model this replaced.
 */
export function createCaptchaSolver(): (image: Uint8Array) => Promise<string> {
    return async (image: Uint8Array): Promise<string> => {
        const session = await loadModel();
        const pixelValues = await toPixelValues(image);
        const output = await session.run({
            [session.inputNames[0]!]: pixelValues,
        });
        return ctcGreedyDecode(output[session.outputNames[0]!]!);
    };
}

/** Saves the image to a temp file, prints its path, and reads the answer
 *  typed at the terminal. Blocks on stdin — only reached once the OCR
 *  attempts are exhausted, which live verification suggests should be rare. */
async function askHuman(image: Uint8Array): Promise<string> {
    const path = join(tmpdir(), `freedns-captcha-${Date.now()}.png`);
    await writeFile(path, image);

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    try {
        const answer = await rl.question(
            `\ncaptcha OCR gave up — open ${path} and type what it says: `,
        );
        return answer.trim();
    } finally {
        rl.close();
    }
}

/**
 * Wraps the OCR solver with a human fallback for the rare miss, rather than
 * trusting any model at 100%. `openTunnel`'s retry loop calls the returned
 * function once per attempt with a fresh captcha each time; this solver
 * spends the first `ocrAttempts` of those on the model (five real FreeDNS
 * submissions in a row were accepted on the first guess, so most calls should
 * never need more than one), then asks a human for the rest of the caller's
 * attempt budget.
 */
export function createHybridCaptchaSolver(
    options: { ocrAttempts?: number } = {},
): (image: Uint8Array) => Promise<string> {
    const ocrSolve = createCaptchaSolver();
    const ocrAttempts = options.ocrAttempts ?? 4;
    let calls = 0;

    return async (image: Uint8Array): Promise<string> => {
        calls++;
        if (calls <= ocrAttempts) {
            try {
                return await ocrSolve(image);
            } catch (error) {
                process.stderr.write(
                    `captcha OCR attempt ${calls} failed: ${error instanceof Error ? error.message : error}\n`,
                );
            }
        }
        return askHuman(image);
    };
}
