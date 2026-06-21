import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(import.meta.dirname, "data");
mkdirSync(dir, { recursive: true });

export const districtDb = new Database(resolve(dir, "districts.sqlite"));

districtDb.run(`
    CREATE TABLE IF NOT EXISTS districts (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        lea_id TEXT    NOT NULL,
        name   TEXT    NOT NULL,
        lat    REAL    NOT NULL,
        lon    REAL    NOT NULL
    )
`);

districtDb.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS districts_lea_id_idx ON districts(lea_id)`,
);

districtDb.run(
    `CREATE INDEX IF NOT EXISTS districts_lat_lon_idx ON districts(lat, lon)`,
);
