import { checkStatus } from "./broker";

const CATEGORY_BIT_NAMES: Record<number, string> = {
    1: "Streaming Media / YouTube-specific",
    2: "Educational / reference",
    3: "Pornography",
    4: "Drugs",
    5: "Gambling",
    6: "Violence / Weapons",
    7: "Hate speech / Discrimination",
    8: "Anonymizers / Proxy / VPN",
    9: "Chat/Messaging",
    10: "Web Mail",
    11: "Gaming / Entertainment",
    12: "Shopping / eCommerce",
    13: "Social networking",
    14: "News / Media",
    15: "Sports",
    17: "Health",
    18: "Finance / Banking",
    19: "Travel",
    20: "Technology / Software",
    21: "Arts & Entertainment",
    22: "Self-harm / Crisis content",
    24: "Web Mail / account portal",
    27: "Terrorism / Extremism",
    28: "Child Safety / IWF content",
    29: "Profanity / Vulgarity",
    30: "Illegal / Criminal activity",
    31: "Educational / general information",
    32: "Malware / Phishing",
    33: "Peer-to-peer / Illegal downloads",
    34: "Nudity / Partial nudity",
    35: "Lifestyle / Personal blogs",
    36: "Non-cacheable / always re-broker",
    37: "Health / drugs classifier group",
    38: "Bullying / Cyberbullying",
    39: "Alcohol / Tobacco",
    40: "Safe-for-work Adult",
    41: "Unknown high-order category",
} as const;

const SHARED_BIT_NAMES: Record<number, string> = {
    16: "Shared classifier flag",
    23: "Shared app/content flag",
    25: "Shared web/content flag",
    26: "Shared known-site flag",
    42: "Shared high-order classifier flag",
} as const;

function decodeSecurlyCategoryId(categoryId: string) {
    if (!/^\d+$/.test(categoryId)) {
        return {
            kind: "symbolic" as const,
            raw: categoryId,
            symbolic: categoryId,
            labels: [categoryId],
            bits: [],
        };
    }

    const mask = BigInt(categoryId);
    const bits: number[] = [];

    for (let bit = 0; bit < 64; bit++) {
        if ((mask & (1n << BigInt(bit))) !== 0n) {
            bits.push(bit);
        }
    }

    return {
        kind: "bitmask" as const,
        raw: categoryId,
        hex: `0x${mask.toString(16)}`,
        bits,
        labels: bits.map(
            bit =>
                CATEGORY_BIT_NAMES[bit] ??
                SHARED_BIT_NAMES[bit] ??
                `Unknown category bit ${bit}`,
        ),
    };
}

const checkResult = await checkStatus({
    useremail: "spstudent1@d11.org",
    host: "pornhub.com",
    extensionId: "ckecmkbnoanpgplccmnoikfmpcdladkc",
});

if (checkResult.isErr()) {
    console.error(checkResult.error);
} else {
    console.log(checkResult.value);
    console.log(decodeSecurlyCategoryId(checkResult.value.categoryId!));
}
