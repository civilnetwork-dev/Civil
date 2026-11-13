import { afterEach, expect, it, vi } from "vitest";

import { checkHaparaFilter } from "./checker";

const focusLink = "https://lesson.invalid/Unit";
const focusChecks = [
    [focusLink, "allowed"],
    ["http://lesson.invalid/Unit", "allowed"],
    ["https://lesson.invalid/Unit/", "allowed"],
    ["https://lesson.invalid/unit", "blocked"],
    ["https://lesson.invalid/Unit/child", "blocked"],
].map(([url, status]) => [focusLink, url, status]);

const docs = "https://docs.google.com/document/d/DocA/edit";
const googleChecks = [
    [docs, "https://docs.google.com/document/d/DocA/preview", "allowed"],
    [docs, "https://drive.google.com/file/d/DocA/view", "allowed"],
    [docs, "https://docs.google.com/document/d/doca/edit", "blocked"],
    [
        docs,
        "https://other.invalid/docs.google.com/document/d/DocA/edit",
        "blocked",
    ],
    ["https://drive.google.com/open?id=DocA", docs, "allowed"],
    ["https://drive.google.com/open?id=DocA&foo=1", docs, "blocked"],
    [
        "https://docs.google.com/forms/u/0/d/e/FormA/viewform",
        "https://docs.google.com/forms/d/e/FormA/formResponse",
        "allowed",
    ],
    [
        "https://docs.google.com/forms/u/1/d/e/FormA/viewform",
        "https://docs.google.com/forms/u/1/d/e/FormB/viewform",
        "blocked",
    ],
    [
        "https://classroom.google.com/c/courseA/a/AssignmentA/details",
        "https://classroom.google.com/c/courseB/a/AssignmentA/details",
        "allowed",
    ],
    [
        "https://accounts.google.com/a",
        "https://accounts.google.com/b",
        "allowed",
    ],
    ["http://accounts.google.com/a", "http://accounts.google.com/b", "blocked"],
    [
        "https://www.google.com/search?q=a",
        "https://www.google.com/search?q=b",
        "allowed",
    ],
    [
        "https://www.google.com/search",
        "https://www.google.com/search?q=b",
        "blocked",
    ],
    [
        "http://www.google.com/search?q=a",
        "https://www.google.com/search?q=b",
        "blocked",
    ],
    [
        "https://www.google.com.evil.invalid/search?q=a",
        "https://www.google.com.evil.invalid/search?q=b",
        "blocked",
    ],
];

afterEach(() => vi.unstubAllGlobals());

it.each([...focusChecks, ...googleChecks])(
    "Focus link %s with %s is %s",
    async (link, url, status) => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                Response.json({
                    CurrentSessions: [
                        {
                            ID: "fixture",
                            Type: "focus",
                            Links: [link],
                            FocusSessionDetails: { FocusType: "links" },
                        },
                    ],
                }),
            ),
        );

        const result = await checkHaparaFilter(
            {
                url,
                student: { kind: "by-id", userId: "fixture", classIds: [] },
            },
            { apiBaseUrl: "https://fixture.invalid" },
        );

        expect(result._unsafeUnwrap()).toMatchObject({
            status,
            matched: status === "allowed" ? [link] : [],
        });
    },
);
