import type { Db, ListOpts, Row } from "./types";

/** לקוח קטן ל-PostgREST של Supabase (בלי תלויות חיצוניות) */
export class SupabaseDb implements Db {
  constructor(private url: string, private key: string) {}

  private headers(extra: Record<string, string> = {}) {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private qs(match: Row = {}) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(match)) p.append(k, `eq.${v}`);
    return p;
  }

  private async call(path: string, init: RequestInit): Promise<any> {
    const res = await fetch(`${this.url}/rest/v1/${path}`, init);
    if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async get(table: string, match: Row) {
    const rows = await this.list(table, { match, limit: 1 });
    return rows[0] ?? null;
  }

  async list(table: string, opts: ListOpts = {}) {
    const p = this.qs(opts.match);
    if (opts.order) p.set("order", opts.order);
    if (opts.limit) p.set("limit", String(opts.limit));
    return (await this.call(`${table}?${p}`, { headers: this.headers() })) ?? [];
  }

  async insert(table: string, row: Row) {
    const r = await this.call(table, {
      method: "POST",
      headers: this.headers({ Prefer: "return=representation" }),
      body: JSON.stringify(row),
    });
    return r[0];
  }

  async insertMany(table: string, rows: Row[]) {
    for (let i = 0; i < rows.length; i += 500) {
      await this.call(table, {
        method: "POST",
        headers: this.headers({ Prefer: "return=minimal" }),
        body: JSON.stringify(rows.slice(i, i + 500)),
      });
    }
  }

  async update(table: string, match: Row, patch: Row) {
    await this.call(`${table}?${this.qs(match)}`, {
      method: "PATCH",
      headers: this.headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(patch),
    });
  }

  async upsert(table: string, row: Row, onConflict: string) {
    const r = await this.call(`${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: this.headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(row),
    });
    return r[0];
  }

  async remove(table: string, match: Row) {
    await this.call(`${table}?${this.qs(match)}`, { method: "DELETE", headers: this.headers() });
  }

  async removeOlderThan(table: string, col: string, isoDate: string) {
    await this.call(`${table}?${col}=lt.${encodeURIComponent(isoDate)}`, {
      method: "DELETE",
      headers: this.headers(),
    });
  }
}
