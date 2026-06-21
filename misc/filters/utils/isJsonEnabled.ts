import type { Express, Router } from "express";

export function isJsonEnabled(app: Express): boolean {
    return ((app._router as Router) ?? { stack: [] }).stack.some(
        layer => layer.name === "json",
    );
}
