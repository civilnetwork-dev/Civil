import { describe, expect, it } from "vitest";

import { type Category, toCategories, toCategory } from "./categories";
import { CATEGORY_BIT_NAMES } from "./securly/categories";

/**
 * Vendor names, as each taxonomy spells them, and the one name Civil reports.
 * The rules are ordered, so the cases here are mostly the ones an order
 * change would break: a name that also contains a broader rule's keyword.
 */
const EXPECTED: Record<string, Category> = {
    // FortiGuard and Blocksi
    "Sex Education": "Sex Education",
    Pornography: "Pornography",
    "Other Adult Materials": "Mature",
    "Nudity and Risque": "Nudity",
    "Lingerie and Swimsuit": "Nudity",
    "Proxy Avoidance": "Proxy & VPN",
    "Peer-to-peer File Sharing": "File Sharing",
    "Freeware and Software Downloads": "Technology",
    "Web-based Email": "Email",
    "Newsgroups and Message Boards": "Forums & Blogs",
    "News and Media": "News",
    "Sports Hunting and War Games": "Weapons",
    "Explicit Violence": "Violence",
    "Extremist Groups": "Extremism",
    "Illegal or Unethical": "Illegal Activity",
    "Crypto Mining": "Malware & Phishing",
    Cryptocurrency: "Finance",
    "Job Search": "Business",
    "Search Engines and Portals": "Search Engines",
    "Child Education": "Education",
    "Child Abuse": "Child Abuse",
    "Artificial Intelligence Technology": "Artificial Intelligence",
    "Internet Radio and TV": "Streaming Media",
    "Internet Telephony": "Chat & Messaging",
    "Dynamic DNS": "New & Parked Domains",
    "Dynamic Content": "Technology",
    "Web Analytics": "Advertising",
    "Advocacy Organizations": "Government & Politics",
    "General Organizations": "Business",
    "Not Rated": "Uncategorized",
    // Securly's bit names
    "Anonymizers / Proxy / VPN": "Proxy & VPN",
    "Peer-to-peer / Illegal downloads": "File Sharing",
    "Gaming / Entertainment": "Games",
    "Violence / Weapons": "Violence",
    "Health / drugs classifier group": "Drugs",
    "Self-harm / Crisis content": "Self-Harm",
    "Child Safety / IWF content": "Child Abuse",
    "Safe-for-work Adult": "Mature",
    // Lightspeed's dotted names
    "security.proxy": "Proxy & VPN",
    "security.translators": "Proxy & VPN",
    "security.shorteners": "Technology",
    "education.sex": "Sex Education",
    "education.music": "Education",
    "education.games": "Education",
    "mature.language": "Profanity",
    "forums.personals": "Dating",
    "forums.im": "Chat & Messaging",
    "forums.email": "Email",
    "forums.p2p": "File Sharing",
    "forums.social_networking": "Social Media",
    "kids_and_teens.chat": "Chat & Messaging",
    "sports.esports": "Games",
    "sports.martial_arts": "Sports",
    "society.politics": "Government & Politics",
    "society.crime": "Illegal Activity",
    "business.real_estate": "Finance",
    "computers.analytics": "Advertising",
    "violence.extremism": "Extremism",
    "porn.illicit": "Pornography",
    "ai.generative": "Artificial Intelligence",
    // Free text (Cisco, iboss, Linewize)
    "Web Page Translation": "Proxy & VPN",
    Transportation: "Other",
    Agriculture: "Other",
};

describe("toCategory", () => {
    it("names each vendor's category the one way", () => {
        for (const [name, category] of Object.entries(EXPECTED))
            expect(toCategory(name), name).toBe(category);
    });

    it("has a name for every one of Securly's category bits", () => {
        for (const name of Object.values(CATEGORY_BIT_NAMES))
            expect(toCategory(name), name).not.toBe("Other");
    });
});

describe("toCategories", () => {
    it("drops blanks and repeats", () => {
        expect(
            toCategories(["porn", undefined, " ", "Pornography", "games"]),
        ).toEqual(["Pornography", "Games"]);
    });
});
