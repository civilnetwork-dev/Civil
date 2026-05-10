import { createMiddleware } from "@solidjs/start/middleware";
import { createMemoryHistory } from "@tanstack/solid-router";
import { router } from "./router";

export default createMiddleware({
    onRequest: async event => {
        const url = new URL(event.request.url);
        const path = url.href.replace(url.origin, "");
        router.update({
            history: createMemoryHistory({ initialEntries: [path] }),
        });
        await router.load();
    },
});
