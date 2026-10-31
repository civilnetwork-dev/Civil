import {
    enableCache as enableIpCaching,
    lookup as lookupIp,
} from "doc999tor-fast-geoip";
import type { Context, Hono } from "hono";

import { type AppEnv, clientIp, readJsonBody } from "../../http";
import { respondFilterResult } from "../utils/respondFilterError";
import type { Email, Hostname } from "./broker";
import { checkSecurlyFilter } from "./checker";

async function checkSecurly(c: Context<AppEnv>) {
    enableIpCaching();

    const { useremail, host, extensionId } = (await readJsonBody(c)) as {
        useremail: Email;
        host: Hostname;
        extensionId: string;
    };

    const ipData = await lookupIp(clientIp(c) ?? "");
    const [lat, lng] = ipData?.ll ?? [0, 0];

    const result = await checkSecurlyFilter({
        useremail,
        host,
        extensionId,
        lat,
        lng,
    });
    return respondFilterResult(c, "securly", host, result);
}

export function useSecurlyMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/securly", checkSecurly);
}
