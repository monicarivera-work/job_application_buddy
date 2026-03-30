import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');

/**
 * Sanitizes a filename by keeping only alphanumeric characters, hyphens,
 * underscores, and dots. Throws if the result is empty.
 * This prevents path traversal attacks (e.g., '../../etc/passwd').
 */
function sanitizeFilename(filename: string): string {
  const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safe || safe === '.' || safe === '..') {
    throw new Error(`Invalid filename: ${filename}`);
  }
  return safe;
}

/**
 * Simple local file-storage adapter.
 * In production replace with S3 / GCS / Azure Blob Storage as needed.
 */
export const fileStorage = {
  /**
   * Ensures the upload directory exists.
   */
  ensureDir(): void {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  },

  /**
   * Writes a buffer to disk and returns the absolute path.
   */
  async save(filename: string, data: Buffer): Promise<string> {
    const safe = sanitizeFilename(filename);
    this.ensureDir();
    const dest = path.join(UPLOAD_DIR, safe);
    await fs.promises.writeFile(dest, data);
    return dest;
  },

  /**
   * Reads a previously saved file and returns its contents.
   */
  async read(filename: string): Promise<Buffer> {
    const safe = sanitizeFilename(filename);
    const src = path.join(UPLOAD_DIR, safe);
    return fs.promises.readFile(src);
  },

  /**
   * Deletes a file from storage.
   */
  async delete(filename: string): Promise<void> {
    const safe = sanitizeFilename(filename);
    const target = path.join(UPLOAD_DIR, safe);
    await fs.promises.unlink(target);
  },
};
