import { expect, it } from "vitest";

import fixtures from "./fixtures/native-signatures.json";
import { verifyRelayReply } from "./replySignature";

// Expected results come from the signed agent's actual PubKeyVerify WASM,
// using synthetic replies and analyst keys. No vendor private key is retained.
it.each(fixtures.cases)("matches native signature verifier: $name", test => {
    const reply = { ...JSON.parse(test.message), signature: test.signature };
    expect(verifyRelayReply(reply, test.publicKey)).toBe(test.expected);
});
