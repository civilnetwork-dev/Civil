import { init } from "@plausible-analytics/tracker";

if (window.location.host === "civil.quartinal.me")
    init({
        domain: window.location.host,
        endpoint: "https://analytics.quartinal.click/api/event",
    });
