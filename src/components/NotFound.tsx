import * as s from "~/styles/NotFound.css";

export default function NotFound() {
    return (
        <div class={s.notFoundRoot}>
            <div class={s.notFoundBackground} />
            <main class={s.notFoundContent}>
                <h1 class={s.notFoundTitle}>404</h1>
                <p class={s.notFoundSubtitle}>Page not found.</p>
                <a class={s.notFoundHomeLink} href="/">
                    Back to home
                </a>
            </main>
        </div>
    );
}
