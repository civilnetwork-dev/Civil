let _promise: Promise<
    import("@quartinal/civil-database/client").Civil2Client
> | null = null;

function getClient() {
    _promise ??= import("@quartinal/civil-database/client").then(
        ({ createCivil2Client }) =>
            createCivil2Client({
                endpoint: "https://db.civil.quartinal.me/graphql",
                dev: window.location.protocol !== "https:",
            }),
    );
    return _promise;
}

export async function trackVisit(url: string) {
    const client = await getClient();
    return client.trackVisit(url);
}
