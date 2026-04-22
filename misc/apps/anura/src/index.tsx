import { render } from "solid-js/web";
import BrowserChrome from "./components/BrowserChrome";

const root = document.getElementById("root");
if (root) render(() => <BrowserChrome />, root);
