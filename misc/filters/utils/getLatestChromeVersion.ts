import xior from "xior";

export async function getLatestChromeVersion(): Promise<string> {
    const response = await xior.get(
        "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json",
        { responseType: "json" },
    );

    return response.data?.channels?.Stable?.version;
}
