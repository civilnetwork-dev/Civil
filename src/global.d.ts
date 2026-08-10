/// <reference types="@solidjs/start/env" />

export {};

// solid-icons' IconProps still imports `JSX` from bare "solid-js", which lost
// its DOM-specific SVG attribute typing (including `class`) when solid-js 2.0
// split that out to "@solidjs/web". Every icon usage in this codebase passes
// `class`, so restore it here instead of touching the third-party package.
// (The `export {}` above makes this file a module so this augmentation
// actually merges into solid-icons' real types instead of being ignored.)
declare module "solid-icons" {
    interface IconProps {
        class?: string;
    }
}
