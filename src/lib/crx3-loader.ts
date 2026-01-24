import EventEmitter from "eventemitter3";
//@ts-expect-error
import { Filer } from "filer";
import type {
  CRX3LoaderEvents,
  LoadStats,
  LoadMetadata,
} from "~/types/extensions.ts";
import { CRX3Unpacker } from "./crx3-unpacker.ts";

export class CRX3Loader extends EventEmitter<CRX3LoaderEvents> {
  private fs: Filer;
  private unpacker: CRX3Unpacker;

  constructor() {
    super();
    this.fs = new Filer();
    this.unpacker = new CRX3Unpacker();

    this.unpacker.on("unpack:progress", (percent, file) => {
      this.emit("load:progress", percent, file, 0);
    });
  }

  async loadUnpacked(folderPath: string): Promise<string> {
    const startTime = Date.now();
    const totalSize = 0;
    const filesProcessed = 0;

    try {
      const metadata: LoadMetadata = {
        timestamp: Date.now(),
        source: "unpacked",
        originalPath: folderPath,
      };

      this.emit("load:start", folderPath, false, metadata);

      const outputDir = `/extensions/${Date.now()}-${this.generateId()}`;
      await this.fs.mkdir(outputDir, { recursive: true });

      const stats = await this.copyFolder(folderPath, outputDir);
      const manifest = JSON.parse(
        await this.fs.readFile(`${outputDir}/manifest.json`, "utf8"),
      );

      const loadStats: LoadStats = {
        ...stats,
        manifestVersion: manifest.manifest_version,
        permissions: manifest.permissions || [],
        duration: Date.now() - startTime,
        compressionRatio: 1,
      };

      this.emit("load:complete", outputDir, loadStats);
      return outputDir;
    } catch (error) {
      this.emit("load:error", error as Error, "copying");
      throw error;
    }
  }

  async loadPacked(crxPath: string): Promise<string> {
    const startTime = Date.now();

    try {
      const metadata: LoadMetadata = {
        timestamp: Date.now(),
        source: "packed",
        originalPath: crxPath,
      };

      this.emit("load:start", crxPath, true, metadata);

      const crxContent = await this.fs.readFile(crxPath);
      const outputDir = `/extensions/${Date.now()}-${this.generateId()}`;

      // Use unpacker to extract contents
      await this.unpacker.unpack(Buffer.from(crxContent), outputDir);

      const manifest = JSON.parse(
        await this.fs.readFile(`${outputDir}/manifest.json`, "utf8"),
      );
      const stats = await this.getDirectoryStats(outputDir);

      const loadStats: LoadStats = {
        ...stats,
        manifestVersion: manifest.manifest_version,
        permissions: manifest.permissions || [],
        duration: Date.now() - startTime,
        compressionRatio: crxContent.length / stats.totalSize,
      };

      this.emit("load:complete", outputDir, loadStats);
      return outputDir;
    } catch (error) {
      this.emit("load:error", error as Error, "validation");
      throw error;
    }
  }

  private async copyFolder(src: string, dest: string) {
    let totalSize = 0;
    let filesProcessed = 0;

    const copyRecursive = async (source: string, target: string) => {
      const entries = await this.fs.readdir(source);

      for (const entry of entries) {
        const sourcePath = `${source}/${entry}`;
        const targetPath = `${target}/${entry}`;

        const stats = await this.fs.stat(sourcePath);

        if (stats.isDirectory()) {
          await this.fs.mkdir(targetPath, { recursive: true });
          await copyRecursive(sourcePath, targetPath);
        } else {
          const content = await this.fs.readFile(sourcePath);
          await this.fs.writeFile(targetPath, content);

          totalSize += stats.size;
          filesProcessed++;

          this.emit(
            "load:progress",
            (filesProcessed / entries.length) * 100,
            entry,
            entries.length - filesProcessed,
          );
        }
      }
    };

    await copyRecursive(src, dest);

    return {
      filesProcessed,
      totalSize,
    };
  }

  private async getDirectoryStats(dir: string) {
    let totalSize = 0;
    let filesProcessed = 0;

    const processDir = async (path: string) => {
      const entries = await this.fs.readdir(path);

      for (const entry of entries) {
        const fullPath = `${path}/${entry}`;
        const stats = await this.fs.stat(fullPath);

        if (stats.isDirectory()) {
          await processDir(fullPath);
        } else {
          totalSize += stats.size;
          filesProcessed++;
        }
      }
    };

    await processDir(dir);

    return {
      filesProcessed,
      totalSize,
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
