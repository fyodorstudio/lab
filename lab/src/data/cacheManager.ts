import fs from 'fs';
import path from 'path';

export class CacheManager {
  private cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  public has(key: string): boolean {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    return fs.existsSync(filePath);
  }

  public get<T>(key: string): T | null {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (err) {
      console.error(`Failed to read cache for ${key}:`, err);
      return null;
    }
  }

  public set<T>(key: string, data: T): void {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    } catch (err) {
      console.error(`Failed to write cache for ${key}:`, err);
    }
  }

  public clear(): void {
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      for (const f of files) {
        fs.unlinkSync(path.join(this.cacheDir, f));
      }
    }
  }
}
