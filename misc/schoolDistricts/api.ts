import { Hono } from "hono";

import { cached } from "../database/cache";
import { districtDb } from "./db";

interface DistrictRow {
    lea_id: string;
    name: string;
    lat: number;
    lon: number;
}

interface NearestResult {
    leaId: string;
    name: string;
    distanceKm: number;
}

function haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearest(lat: number, lon: number): NearestResult | null {
    const delta = 1.5;
    let rows = districtDb
        .query<DistrictRow, [number, number, number, number]>(
            `SELECT lea_id, name, lat, lon FROM districts
             WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`,
        )
        .all(lat - delta, lat + delta, lon - delta * 1.5, lon + delta * 1.5);

    if (rows.length === 0) {
        rows = districtDb
            .query<DistrictRow, []>(
                "SELECT lea_id, name, lat, lon FROM districts",
            )
            .all();
    }

    if (rows.length === 0) return null;

    let nearest = rows[0]!;
    let minDist = Infinity;
    for (const row of rows) {
        const d = haversineKm(lat, lon, row.lat, row.lon);
        if (d < minDist) {
            minDist = d;
            nearest = row;
        }
    }

    return { leaId: nearest.lea_id, name: nearest.name, distanceKm: minDist };
}

export function createSchoolDistrictsRouter() {
    const router = new Hono();

    router.get("/nearest", async c => {
        const lat = parseFloat(c.req.query("lat") ?? "");
        const lon = parseFloat(c.req.query("lon") ?? "");

        if (Number.isNaN(lat) || Number.isNaN(lon)) {
            return c.json(
                { error: "lat and lon are required query params" },
                400,
            );
        }

        const cacheKey = `school-district:nearest:${lat.toFixed(2)}:${lon.toFixed(2)}`;

        try {
            const result = await cached<NearestResult | null>(
                cacheKey,
                async () => findNearest(lat, lon),
                3600,
            );

            if (!result) {
                return c.json({ error: "No district found" }, 404);
            }

            return c.json(result);
        } catch (err) {
            console.error("[school-districts] nearest lookup error:", err);
            return c.json({ error: "Internal error" }, 500);
        }
    });

    return router;
}
