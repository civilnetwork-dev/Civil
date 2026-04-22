import { RouterProvider } from "@tanstack/solid-router";
import { router } from "./router";

import "@fontsource/rubik/400.css";
import "@fontsource/rubik/500.css";

import "~/styles/global.css";

export default function App() {
    return <RouterProvider router={router} />;
}
