import { render } from "solid-js/web";
import "@catppuccin/palette/css/catppuccin.css";

function NewTab() {
    const style = document.createElement("style");
    style.textContent = `
        @import url("https://fonts.googleapis.com/css2?family=Rubik:wght@400;500&display=swap");
        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; font-family: "Rubik", ui-sans-serif, sans-serif; }
    `;
    document.head.appendChild(style);

    return (
        <div
            style={{
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                "justify-content": "center",
                width: "100%",
                height: "100%",
                background: "var(--ctp-macchiato-base)",
                color: "var(--ctp-macchiato-text)",
                "font-family": "'Rubik', ui-sans-serif, sans-serif",
            }}
        >
            <h1
                style={{
                    "font-size": "2rem",
                    "font-weight": 500,
                    "margin-bottom": "0.5rem",
                    color: "var(--ctp-macchiato-lavender)",
                }}
            >
                New Tab
            </h1>
            <p
                style={{
                    color: "var(--ctp-macchiato-subtext0)",
                    "font-size": "0.9rem",
                }}
            >
                Start typing in the address bar to get started.
            </p>
        </div>
    );
}

const root = document.getElementById("root");
if (root) render(() => <NewTab />, root);
