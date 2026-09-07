import { describe, expect, it } from "vitest";

import { isPrivateHost } from "../misc/net";

describe("isPrivateHost", () => {
    it("blocks loopback names and addresses", () => {
        expect(isPrivateHost("localhost")).toBe(true);
        expect(isPrivateHost("LOCALHOST")).toBe(true);
        expect(isPrivateHost("127.0.0.1")).toBe(true);
        expect(isPrivateHost("127.1.2.3")).toBe(true);
        expect(isPrivateHost("0.0.0.0")).toBe(true);
    });

    it("blocks RFC1918 ranges", () => {
        expect(isPrivateHost("10.0.0.1")).toBe(true);
        expect(isPrivateHost("192.168.1.1")).toBe(true);
        expect(isPrivateHost("172.16.0.1")).toBe(true);
        expect(isPrivateHost("172.31.255.255")).toBe(true);
    });

    it("does not over-block 172.x outside the private range", () => {
        // 172.16.0.0–172.31.255.255 is private; 172.15 and 172.32 are public.
        expect(isPrivateHost("172.15.0.1")).toBe(false);
        expect(isPrivateHost("172.32.0.1")).toBe(false);
    });

    it("blocks link-local, used by cloud metadata services", () => {
        // 169.254.169.254 is the AWS/GCP/Azure instance metadata endpoint.
        expect(isPrivateHost("169.254.169.254")).toBe(true);
    });

    it("blocks internal-only suffixes", () => {
        expect(isPrivateHost("postgres.local")).toBe(true);
        expect(isPrivateHost("db.internal")).toBe(true);
        expect(isPrivateHost("app.localhost")).toBe(true);
    });

    it("blocks IPv6 loopback and private ranges", () => {
        expect(isPrivateHost("::1")).toBe(true);
        expect(isPrivateHost("fe80::1")).toBe(true);
        expect(isPrivateHost("fc00::1")).toBe(true);
        expect(isPrivateHost("fd00::1")).toBe(true);
    });

    it("blocks bracketed IPv6, which is what URL.hostname returns", () => {
        // Regression guard: `new URL("http://[::1]/").hostname` keeps the
        // brackets, so a check against a bare "::1" never fires.
        expect(new URL("http://[::1]/").hostname).toBe("[::1]");
        expect(isPrivateHost(new URL("http://[::1]/").hostname)).toBe(true);
        expect(isPrivateHost(new URL("http://[fd00::1]/").hostname)).toBe(true);
    });

    it("allows ordinary public hosts", () => {
        expect(isPrivateHost("example.com")).toBe(false);
        expect(isPrivateHost("google.com")).toBe(false);
        expect(isPrivateHost("8.8.8.8")).toBe(false);
        expect(isPrivateHost("1.1.1.1")).toBe(false);
        expect(isPrivateHost("172.217.0.1")).toBe(false);
    });

    it("is not fooled by a private range appearing mid-hostname", () => {
        expect(isPrivateHost("evil.com/10.0.0.1")).toBe(false);
        expect(isPrivateHost("not-127.0.0.1.example.com")).toBe(false);
    });
});
