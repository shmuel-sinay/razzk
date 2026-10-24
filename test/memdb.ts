import type { Db, ListOpts, Row } from "../src/types";

/** מסד נתונים בזיכרון לבדיקות מקומיות */
export class MemDb implements Db {
  t: Record<string, Row[]> = {};
  private rows(n: string) { return (this.t[n] ||= []); }
  private ok(r: Row, m: Row = {}) { return Object.entries(m).every(([k, v]) => String(r[k]) === String(v)); }
  async get(n: string, m: Row) { return this.rows(n).find((r) => this.ok(r, m)) ?? null; }
  async list(n: string, o: ListOpts = {}) {
    let out = this.rows(n).filter((r) => this.ok(r, o.match));
    if (o.order) { const [c, dir] = o.order.split("."); out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : -1) * (dir === "desc" ? -1 : 1)); }
    return o.limit ? out.slice(0, o.limit) : out;
  }
  async insert(n: string, row: Row) { const r = { id: crypto.randomUUID(), created_at: new Date(Date.now() + this.rows(n).length).toISOString(), ...row }; this.rows(n).push(r); return r; }
  async insertMany(n: string, rows: Row[]) { for (const r of rows) await this.insert(n, r); }
  async update(n: string, m: Row, p: Row) { for (const r of this.rows(n)) if (this.ok(r, m)) Object.assign(r, p); }
  async upsert(n: string, row: Row, on: string) {
    const keys = on.split(",");
    const ex = this.rows(n).find((r) => keys.every((k) => r[k] === row[k]));
    if (ex) { Object.assign(ex, row); return ex; }
    return this.insert(n, row);
  }
  async remove(n: string, m: Row) { this.t[n] = this.rows(n).filter((r) => !this.ok(r, m)); }
  async removeOlderThan() {}
}
