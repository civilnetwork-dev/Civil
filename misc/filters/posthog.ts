import { PostHog } from "posthog-node";

export const posthog = new PostHog(
    "phc_s9hZNR8XnWnFGHTCSJEZv79HL4hiFqCiRrVXKVboAU2f",
    {
        host: "https://us.i.posthog.com",
        flushAt: 20,
        flushInterval: 10_000,
        // Server events key on the visitor's IP, not a person: without this
        // PostHog makes a person profile for every address it sees.
        before_send: event => ({
            ...event,
            properties: { ...event.properties, $process_person_profile: false },
        }),
    },
);
