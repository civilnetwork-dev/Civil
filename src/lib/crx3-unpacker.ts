import EventEmitter from "eventemitter3";
import type { Buffer } from "node:buffer";
//@ts-expect-error
import { Filer } from "filer";
import { createHash } from "node:crypto";
import type {
  CRX3UnpackerEvents,
  UnpackStats,
  ValidationResult,
} from "~/types/extensions.ts";
import JSZip from "jszip";

interface UnzipStats {
  filesProcessed: number;
  totalSize: number;
  duration: number;
}

interface UnzipEvents {
  "unzip:start": (buffer: Buffer) => void;
  "unzip:progress": (percent: number, currentFile: string) => void;
  "unzip:complete": (files: Map<string, Buffer>, stats: UnzipStats) => void;
  "unzip:error": (error: Error) => void;
}

export class CRX3Unzipper extends EventEmitter<UnzipEvents> {
  private readonly CRX2_HEADER_SIZE = 16;
  private readonly CRX3_HEADER_SIZE = 12;
  private readonly CRX3_MAGIC = "Cr24";
  private readonly META_KEY = "metadata.json";
  private readonly PUBLIC_KEY_SIZE = 32;

  constructor() {
    super();
  }

  private isCRX3(buffer: Buffer): boolean {
    return (
      buffer.toString("utf8", 0, 4) === this.CRX3_MAGIC &&
      buffer.readUInt32LE(4) === 3
    );
  }

  private isCRX2(buffer: Buffer): boolean {
    return (
      buffer.toString("utf8", 0, 4) === this.CRX3_MAGIC &&
      buffer.readUInt32LE(4) === 2
    );
  }

  private getZipStartOffset(buffer: Buffer): number {
    if (this.isCRX3(buffer)) {
      const headerSize = this.CRX3_HEADER_SIZE;
      const pubkeySize = buffer.readUInt32LE(8);
      const signatureSize = buffer.readUInt32LE(12);
      return headerSize + pubkeySize + signatureSize;
    } else if (this.isCRX2(buffer)) {
      const pubkeySize = buffer.readUInt32LE(8);
      const signatureSize = buffer.readUInt32LE(12);
      return this.CRX2_HEADER_SIZE + pubkeySize + signatureSize;
    }
    throw new Error("Invalid CRX format");
  }

  private async processZipContents(zip: JSZip): Promise<Map<string, Buffer>> {
    const files = new Map<string, Buffer>();
    let processed = 0;
    const totalFiles = Object.keys(zip.files).length;

    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir) {
        const content = await zipEntry.async("nodebuffer");
        files.set(path, content);

        processed++;
        this.emit("unzip:progress", (processed / totalFiles) * 100, path);
      }
    }

    return files;
  }

  async unzip(crxBuffer: Buffer): Promise<Map<string, Buffer>> {
    const startTime = Date.now();
    this.emit("unzip:start", crxBuffer);

    try {
      const zipStartOffset = this.getZipStartOffset(crxBuffer);
      const zipData = crxBuffer.subarray(zipStartOffset);

      const zip = await JSZip.loadAsync(zipData);

      const files = await this.processZipContents(zip);

      let totalSize = 0;
      for (const file of files.values()) {
        totalSize += file.length;
      }

      const stats: UnzipStats = {
        filesProcessed: files.size,
        totalSize,
        duration: Date.now() - startTime,
      };

      this.emit("unzip:complete", files, stats);
      return files;
    } catch (error) {
      this.emit("unzip:error", error as Error);
      throw error;
    }
  }

  async getManifestVersion(files: Map<string, Buffer>): Promise<number> {
    const manifestFile = files.get("manifest.json");
    if (!manifestFile) {
      throw new Error("No manifest.json found");
    }

    const manifest = JSON.parse(manifestFile.toString("utf8"));
    return manifest.manifest_version || 2;
  }
}

export class CRX3Unpacker extends EventEmitter<CRX3UnpackerEvents> {
  private fs: Filer;
  private unzipper: CRX3Unzipper;
  private readonly REQUIRED_FILES = ["manifest.json", "background.js"];
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024;

  constructor() {
    super();
    this.fs = new Filer();
    this.unzipper = new CRX3Unzipper();

    this.unzipper.on("unzip:progress", (percent, file) => {
      this.emit("unpack:progress", percent, file);
    });
  }

  private async validateCRX(buffer: Buffer): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (buffer.subarray(0, 4).toString() !== "Cr24") {
      errors.push("Invalid CRX header magic number");
    }

    const version = buffer.readUInt32LE(4);
    if (version !== 3) {
      errors.push(`Unsupported CRX version: ${version}`);
    }

    if (buffer.length > this.MAX_FILE_SIZE) {
      warnings.push(
        `File size exceeds recommended maximum of ${this.MAX_FILE_SIZE} bytes`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async unpack(crxBuffer: Buffer, outputPath: string): Promise<string> {
    const startTime = Date.now();

    try {
      this.emit("unpack:start", outputPath);

      const validation = await this.validateCRX(crxBuffer);
      this.emit("unpack:validate", validation);

      if (!validation.isValid) {
        throw new Error("CRX validation failed");
      }

      const files = await this.unzipper.unzip(crxBuffer);

      const hash = createHash("sha256");
      hash.update(crxBuffer);

      await this.fs.mkdir(outputPath, { recursive: true });

      let totalSize = 0;
      let filesProcessed = 0;

      for (const [path, content] of files.entries()) {
        const fullPath = `${outputPath}/${path}`;
        await this.fs.mkdir(this.fs.dirname(fullPath), { recursive: true });

        await this.fs.writeFile(fullPath, content);

        totalSize += content.length;
        filesProcessed++;
      }

      const stats: UnpackStats = {
        filesProcessed,
        totalSize,
        duration: Date.now() - startTime,
        compressionRatio: crxBuffer.length / totalSize,
      };

      this.emit("unpack:complete", outputPath, stats);
      return outputPath;
    } catch (error) {
      this.emit("unpack:error", error as Error, "extraction");
      throw error;
    }
  }
}
