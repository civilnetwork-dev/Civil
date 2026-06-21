import { PostHog } from "posthog-node";

export const posthog = new PostHog(
    "phc_s9hZNR8XnWnFGHTCSJEZv79HL4hiFqCiRrVXKVboAU2f",
    {
        host: "https://us.i.posthog.com",
        flushAt: 20,
        flushInterval: 10_000,
    },
);
