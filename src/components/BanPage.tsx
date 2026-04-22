import * as s from "~/styles/BanPage.css";

export default function BanPage({ banReason }: { banReason: string }) {
    return (
        <div class={s.banRoot}>
            <div class={s.banText}>
                <h1>Banned</h1>
                <p>{banReason ?? "You have been banned from this proxy"}</p>
                <a href="/baninfo" target="_blank" rel="noopener">
                    Click here to figure out why you have been banned
                </a>
            </div>
        </div>
    );
}
