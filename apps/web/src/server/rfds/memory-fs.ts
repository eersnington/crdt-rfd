type Entry =
  | { readonly kind: "dir"; readonly children: Set<string>; readonly mtimeMs: number }
  | { readonly kind: "file"; readonly data: Uint8Array; readonly mtimeMs: number }
  | { readonly kind: "symlink"; readonly target: string; readonly mtimeMs: number };

class MemoryFSError extends Error {
  constructor(
    readonly code: string,
    path: string,
  ) {
    super(`${code}: ${path}`);
  }
}

class MemoryStats {
  constructor(private readonly entry: Entry) {}

  get size() {
    return this.entry.kind === "file" ? this.entry.data.byteLength : 0;
  }

  get mtimeMs() {
    return this.entry.mtimeMs;
  }

  get ctimeMs() {
    return this.entry.mtimeMs;
  }

  get mode() {
    if (this.entry.kind === "file") return 0o100644;
    return this.entry.kind === "dir" ? 0o040000 : 0o120000;
  }

  isFile() {
    return this.entry.kind === "file";
  }

  isDirectory() {
    return this.entry.kind === "dir";
  }

  isSymbolicLink() {
    return this.entry.kind === "symlink";
  }
}

export class MemoryFS {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private readonly entries = new Map<string, Entry>([
    ["/", { kind: "dir", children: new Set(), mtimeMs: Date.now() }],
  ]);

  readonly promises = {
    readFile: this.readFile.bind(this),
    writeFile: this.writeFile.bind(this),
    unlink: this.unlink.bind(this),
    readdir: this.readdir.bind(this),
    mkdir: this.mkdir.bind(this),
    rmdir: this.rmdir.bind(this),
    stat: this.stat.bind(this),
    lstat: this.lstat.bind(this),
    readlink: this.readlink.bind(this),
    symlink: this.symlink.bind(this),
  };

  private normalize(input: string) {
    const segments: string[] = [];
    for (const part of input.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") segments.pop();
      else segments.push(part);
    }
    return segments.length === 0 ? "/" : `/${segments.join("/")}`;
  }

  private parent(path: string) {
    const parts = this.normalize(path).split("/").filter(Boolean);
    parts.pop();
    return parts.length === 0 ? "/" : `/${parts.join("/")}`;
  }

  private basename(path: string) {
    return this.normalize(path).split("/").filter(Boolean).at(-1) ?? "";
  }

  private requireEntry(path: string) {
    const entry = this.entries.get(this.normalize(path));
    if (entry === undefined) throw new MemoryFSError("ENOENT", path);
    return entry;
  }

  private requireDir(path: string) {
    const entry = this.requireEntry(path);
    if (entry.kind !== "dir") throw new MemoryFSError("ENOTDIR", path);
    return entry;
  }

  async mkdir(path: string, options?: { recursive?: boolean } | number) {
    const target = this.normalize(path);
    if (target === "/") return;
    const parent = this.parent(target);
    if (!this.entries.has(parent)) {
      if (typeof options !== "object" || options?.recursive !== true) {
        throw new MemoryFSError("ENOENT", parent);
      }
      await this.mkdir(parent, { recursive: true });
    }
    if (this.entries.has(target)) return;
    this.entries.set(target, { kind: "dir", children: new Set(), mtimeMs: Date.now() });
    this.requireDir(parent).children.add(this.basename(target));
  }

  async writeFile(path: string, data: string | Uint8Array | ArrayBuffer) {
    const target = this.normalize(path);
    await this.mkdir(this.parent(target), { recursive: true });
    const bytes =
      typeof data === "string"
        ? this.encoder.encode(data)
        : data instanceof Uint8Array
          ? data
          : new Uint8Array(data);
    this.entries.set(target, { kind: "file", data: bytes, mtimeMs: Date.now() });
    this.requireDir(this.parent(target)).children.add(this.basename(target));
  }

  async readFile(path: string, options?: string | { encoding?: string }) {
    const entry = this.requireEntry(path);
    if (entry.kind !== "file") throw new MemoryFSError("EISDIR", path);
    const encoding = typeof options === "string" ? options : options?.encoding;
    return encoding ? this.decoder.decode(entry.data) : entry.data;
  }

  async readdir(path: string) {
    return [...this.requireDir(path).children].sort();
  }

  async unlink(path: string) {
    const target = this.normalize(path);
    if (this.requireEntry(target).kind === "dir") throw new MemoryFSError("EISDIR", path);
    this.entries.delete(target);
    this.requireDir(this.parent(target)).children.delete(this.basename(target));
  }

  async rmdir(path: string) {
    const target = this.normalize(path);
    const entry = this.requireDir(target);
    if (entry.children.size > 0) throw new MemoryFSError("ENOTEMPTY", path);
    this.entries.delete(target);
    this.requireDir(this.parent(target)).children.delete(this.basename(target));
  }

  async stat(path: string) {
    return new MemoryStats(this.requireEntry(path));
  }

  async lstat(path: string) {
    return this.stat(path);
  }

  async readlink(path: string, options?: string | { encoding?: string }) {
    const entry = this.requireEntry(path);
    if (entry.kind !== "symlink") throw new MemoryFSError("EINVAL", path);
    const encoding = typeof options === "string" ? options : options?.encoding;
    return encoding === "buffer" ? this.encoder.encode(entry.target) : entry.target;
  }

  async symlink(target: string | Uint8Array, path: string) {
    const normalized = this.normalize(path);
    const parent = this.parent(normalized);
    await this.mkdir(parent, { recursive: true });
    const value = typeof target === "string" ? target : this.decoder.decode(target);
    this.entries.set(normalized, { kind: "symlink", target: value, mtimeMs: Date.now() });
    this.requireDir(parent).children.add(this.basename(normalized));
  }
}
