/**
 * The one set of category names every checker under misc/filters reports.
 *
 * Each vendor rates a page in its own taxonomy: FortiGuard and Blocksi say
 * "Proxy Avoidance", Securly "Anonymizers / Proxy / VPN", Lightspeed
 * "security.proxy". A reader comparing filters on the filter check page, or
 * code deciding what a school would block (domainReputation.ts), needs one
 * name for one thing, so every checker passes its vendor's names through
 * `toCategories` and reports these instead.
 *
 * The mapping is by keyword rather than by a table per vendor: Lightspeed
 * fetches its taxonomy at run time, and Linewize and Cisco send free-text
 * names, so a rule over the words outlives any table of them.
 * categories.test.ts pins each taxonomy's names, the ones a reordered rule
 * would send elsewhere first.
 */
export const CATEGORIES = [
    "Pornography",
    "Nudity",
    "Mature",
    "Sex Education",
    "Dating",
    "Drugs",
    "Alcohol & Tobacco",
    "Gambling",
    "Violence",
    "Weapons",
    "Hate Speech",
    "Extremism",
    "Self-Harm",
    "Bullying",
    "Profanity",
    "Child Abuse",
    "Illegal Activity",
    "Hacking",
    "Malware & Phishing",
    "New & Parked Domains",
    "Proxy & VPN",
    "File Sharing",
    "Social Media",
    "Chat & Messaging",
    "Email",
    "Forums & Blogs",
    "Education",
    "Plagiarism",
    "Streaming Media",
    "Games",
    "Sports",
    "News",
    "Shopping",
    "Finance",
    "Artificial Intelligence",
    "Health",
    "Religion",
    "Government & Politics",
    "Business",
    "Search Engines",
    "Travel",
    "Advertising",
    "Entertainment",
    "Technology",
    "Lifestyle",
    "Uncategorized",
    "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * First match wins, so a rule sits above any broader one that would also
 * match its names: "Sex Education" before "Pornography", "Extremism" before
 * "Violence", "Peer-to-peer / Illegal downloads" reaching File Sharing before
 * Illegal Activity, "education.music" reaching Education before Streaming,
 * "Job Search" reaching Business before Search Engines.
 */
const RULES: readonly (readonly [RegExp, Category])[] = [
    [/sex ?educ|education sex/, "Sex Education"],
    [/child (abuse|safety)|\biwf\b/, "Child Abuse"],
    [/porn/, "Pornography"],
    [/nudit|lingerie|swimsuit|risque/, "Nudity"],
    [/self ?harm|suicide|crisis/, "Self-Harm"],
    [/bully/, "Bullying"],
    [/profan|vulgar|mature language|offensive/, "Profanity"],
    [/adult|mature/, "Mature"],
    [/dating|personals/, "Dating"],
    [/marijuana|cannabis|drug/, "Drugs"],
    [/alcohol|tobacco|vap(e|ing)/, "Alcohol & Tobacco"],
    [/gambl|casino|betting|lotter/, "Gambling"],
    [/terror|extremi/, "Extremism"],
    [/violen|gore/, "Violence"],
    [/weapon|firearm|hunting/, "Weapons"],
    [/hate|discriminat/, "Hate Speech"],
    [/hack|nettools/, "Hacking"],
    [
        /malware|malicious|phish|spyware|botnet|spam|crypto ?mining|unwanted program|suspicious/,
        "Malware & Phishing",
    ],
    [
        /newly|dynamic dns|parked|parking|expired|meaningless/,
        "New & Parked Domains",
    ],
    [/prox|anonymi|vpn|translat|avoidance/, "Proxy & VPN"],
    [
        /peer ?to ?peer|\bp2p\b|file ?sharing|file transfer|filehosting|warez|torrent|pirac|illegal downloads?|storage/,
        "File Sharing",
    ],
    [/illegal|unethical|crime|criminal/, "Illegal Activity"],
    [
        /social ?network|facebook|twitter|instagram|pinterest|tiktok|snapchat/,
        "Social Media",
    ],
    [
        /chat|instant messag|messaging|\bim\b|telephony|meeting/,
        "Chat & Messaging",
    ],
    [/mail/, "Email"],
    [/forum|newsgroup|message board|blog|communit/, "Forums & Blogs"],
    [/plagiar/, "Plagiarism"],
    [/educat|reference|school|kids|literature|science|history/, "Education"],
    [/stream|radio|video|youtube|music|audio/, "Streaming Media"],
    [/\bgam(e|es|ing)\b|esports/, "Games"],
    [/\bsports?\b/, "Sports"],
    [/news/, "News"],
    [/shop|auction|commerce|retail/, "Shopping"],
    [
        /financ|bank|brokerage|trading|crypto ?currenc|real estate|insurance/,
        "Finance",
    ],
    [/\bai\b|artificial intelligence/, "Artificial Intelligence"],
    [/health|medic|wellness|fitness/, "Health"],
    [/religio|belief|folklore/, "Religion"],
    [
        /govern|politic|legal|\blaw\b|military|armed forces|advocacy|abortion/,
        "Government & Politics",
    ],
    [
        /business|job|employment|organi[sz]ation|construction|manufactur/,
        "Business",
    ],
    [/search|portal|director/, "Search Engines"],
    [/travel|hotel|airline/, "Travel"],
    [/advert|\bads\b|analytics|marketing/, "Advertising"],
    [/entertain|\barts\b|\bculture|humor|celebrit|movie/, "Entertainment"],
    [
        /tech|computer|software|freeware|shareware|hosting|internet|web ?based|content server|content delivery|\bcdn\b|secure website|remote access|shorten|dynamic content|electronic|information|security|privacy|microsoft/,
        "Technology",
    ],
    [
        /lifestyle|society|hobby|photograph|food|restaurant|dining|vehicle|automobile|family|fashion/,
        "Lifestyle",
    ],
    [/not rated|unrated|uncategori|unknown|under review/, "Uncategorized"],
];

/** The vendor's name for a category, in Civil's vocabulary. */
export function toCategory(vendorName: string): Category {
    const words = vendorName
        .toLowerCase()
        .replace(/[._/-]+/g, " ")
        .trim();
    return RULES.find(([rule]) => rule.test(words))?.[1] ?? "Other";
}

/** A vendor's names for a page's categories, mapped and deduplicated. */
export function toCategories(
    vendorNames: readonly (string | undefined)[],
): Category[] {
    const mapped = vendorNames
        .filter((name): name is string => Boolean(name?.trim()))
        .map(toCategory);
    return [...new Set(mapped)];
}
