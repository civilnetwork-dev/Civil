import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import { open as openShapefile } from "shapefile";
import { districtDb } from "./db";

const NCES_ZIP_URL =
    "https://nces.ed.gov/programs/edge/data/EDGE_SCHOOLDISTRICT_TL25_SY2425.zip";

type Coord = [number, number];

function centroidOfRing(ring: Coord[]): Coord {
    let lat = 0,
        lon = 0;
    for (const [x, y] of ring) {
        lon += x;
        lat += y;
    }
    return [lat / ring.length, lon / ring.length];
}

function centroidOfGeometry(geom: GeoJSON.Geometry): Coord | null {
    if (geom.type === "Polygon") {
        return centroidOfRing(
            (geom as GeoJSON.Polygon).coordinates[0] as Coord[],
        );
    }
    if (geom.type === "MultiPolygon") {
        return centroidOfRing(
            (geom as GeoJSON.MultiPolygon).coordinates[0][0] as Coord[],
        );
    }
    return null;
}

export async function setupSchoolDistricts(): Promise<void> {
    const row = districtDb
        .query<{ n: number }, []>("SELECT COUNT(*) AS n FROM districts")
        .get();
    if (row && row.n > 0) return;

    console.log("[school-districts] Downloading NCES shapefile (~50 MB)…");

    const tmpDir = resolve(import.meta.dirname, "data", "tmp");
    mkdirSync(tmpDir, { recursive: true });

    const zipPath = resolve(tmpDir, "districts.zip");
    if (!existsSync(zipPath)) {
        console.log(
            "[school-districts] Fetching zip (this may take a few minutes)…",
        );
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 min
        let res: Response;
        try {
            res = await fetch(NCES_ZIP_URL, { signal: controller.signal });
        } finally {
            clearTimeout(timeout);
        }
        if (!res!.ok)
            throw new Error(`Failed to download NCES zip: ${res!.status}`);
        const contentLength = res!.headers.get("content-length");
        console.log(
            `[school-districts] Streaming ${contentLength ? `${(+contentLength / 1e6).toFixed(0)} MB` : "unknown size"} to disk…`,
        );
        const { createWriteStream } = await import("node:fs");
        const { pipeline } = await import("node:stream/promises");
        const { Readable } = await import("node:stream");
        const writer = createWriteStream(zipPath);
        await pipeline(
            Readable.fromWeb(
                res!.body as unknown as Parameters<typeof Readable.fromWeb>[0],
            ),
            writer,
        );
        console.log("[school-districts] Download complete.");
    } else {
        console.log("[school-districts] Using cached zip…");
    }

    console.log("[school-districts] Extracting…");
    const zipBytes = new Uint8Array(await Bun.file(zipPath).arrayBuffer());
    const extracted = unzipSync(zipBytes);

    const shpName = Object.keys(extracted).find(f => f.endsWith(".shp"));
    if (!shpName) throw new Error("No .shp file found in NCES zip");
    const dbfName = shpName.replace(/\.shp$/, ".dbf");

    const shpPath = resolve(tmpDir, "districts.shp");
    const dbfPath = resolve(tmpDir, "districts.dbf");
    writeFileSync(shpPath, extracted[shpName]!);
    if (extracted[dbfName]) writeFileSync(dbfPath, extracted[dbfName]!);
    console.log(`[school-districts] Parsing ${shpName}…`);

    const insert = districtDb.prepare(
        "INSERT OR IGNORE INTO districts (lea_id, name, lat, lon) VALUES (?, ?, ?, ?)",
    );

    const insertBatch = districtDb.transaction(
        (rows: [string, string, number, number][]) => {
            for (const [leaId, name, lat, lon] of rows) {
                insert.run(leaId, name, lat, lon);
            }
        },
    );

    const source = await openShapefile(shpPath);
    const batch: [string, string, number, number][] = [];
    let count = 0;

    while (true) {
        const { done, value } = await source.read();
        if (done) break;

        const props = value.properties as Record<string, unknown>;
        const leaId = String(props["GEOID"] ?? props["GEOID10"] ?? "");
        const name = String(props["NAME"] ?? props["NAMELSAD"] ?? "Unknown");
        const geom = value.geometry;

        if (!leaId || !geom) continue;

        const centroid = centroidOfGeometry(geom);
        if (!centroid) continue;

        batch.push([leaId, name, centroid[0], centroid[1]]);

        if (batch.length >= 500) {
            insertBatch(batch.splice(0));
        }
        count++;
    }

    if (batch.length) insertBatch(batch);

    console.log(`[school-districts] Loaded ${count} districts.`);
}
