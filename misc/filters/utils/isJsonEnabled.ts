import type { Express, Router } from "express";

export function isJsonEnabled(app: Express): boolean {
    return (app._router as Router).stack.some(layer => layer.name === "json");
}
