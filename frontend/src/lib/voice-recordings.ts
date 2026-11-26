import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const formats: Record<string, string> = { '.wav': 'audio/wav', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac' };
type Recording = { id: string; organizationId: string; suffix: string; createdAt: number; sha256?: string };

/** Private files, never exposed as static assets. Callers must enforce client admin access. */
export class VoiceRecordings {
  private items: Recording[];
  constructor(private directory: string) {
    const index = path.join(directory, 'index.json');
    this.items = fs.existsSync(index) ? JSON.parse(fs.readFileSync(index, 'utf8')) : [];
    if (!Array.isArray(this.items)) throw new Error('Recording index is invalid.');
  }
  save(organizationId: string, audio: unknown, suffix: unknown, consent: unknown): string | undefined {
    if (consent !== true) return undefined;
    if (typeof suffix !== 'string' || !formats[suffix] || typeof audio !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) throw new Error('Invalid recording.');
    const bytes = Buffer.from(audio, 'base64');
    if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new Error('Recording must be nonempty and at most 12 MB.');
    fs.mkdirSync(this.directory, { recursive: true });
    const item = { id: crypto.randomUUID(), organizationId, suffix, createdAt: Date.now(), sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    const file = path.join(this.directory, item.id + suffix);
    fs.writeFileSync(file, bytes, { mode: 0o600 });
    this.items.push(item);
    try {
      fs.writeFileSync(path.join(this.directory, 'index.json.tmp'), JSON.stringify(this.items), { mode: 0o600 });
      fs.renameSync(path.join(this.directory, 'index.json.tmp'), path.join(this.directory, 'index.json'));
    } catch (error) { this.items.pop(); fs.unlinkSync(file); throw error; }
    return item.id;
  }
  get(organizationId: string, id: string) {
    const item = this.items.find(item => item.id === id && item.organizationId === organizationId);
    if (!item || !/^[a-f0-9-]{36}$/.test(item.id) || !formats[item.suffix]) return null;
    const file = path.join(this.directory, item.id + item.suffix);
    return fs.existsSync(file) ? { file, mimeType: formats[item.suffix] } : null;
  }

  findByHash(organizationId: string, hash: string) {
    if (!/^[a-f0-9]{64}$/.test(hash)) return undefined;
    for (const item of this.items) {
      if (item.organizationId !== organizationId) continue;
      const recording = this.get(organizationId, item.id);
      if (!recording) continue;
      // Backfill hashes in memory for recordings saved before history was supported.
      item.sha256 ??= crypto.createHash('sha256').update(fs.readFileSync(recording.file)).digest('hex');
      if (item.sha256 === hash) return item.id;
    }
    return undefined;
  }
}
