import { Hono } from "hono";
import type { Env } from "./types";
import { SupabaseDb } from "./db";
import { loadSettings } from "./settings";
import { normalize } from "./hebrew";
import { handleIvr } from "./ivr/handler";
import { admin } from "./admin";
import { pub } from "./public";

const app = new Hono<{ Bindings: Env }>();

app.get("/healthz", (c) => c.text("ok"));

/**
 * נקודת הכניסה של ימות המשיח (שלוחת api).
 * כתובת ה-API בימות: https://<הדומיין>/ivr?k=<IVR_SECRET>
 */
app.all("/ivr", async (c) => {
  const q = new URL(c.req.url).searchParams;
  const params: Record<string, string> = Object.fromEntries(q);
  if (c.req.method === "POST") {
    const ct = c.req.header("content-type") || "";
    if (ct.includes("form")) Object.assign(params, Object.fromEntries(await c.req.formData() as any));
  }
  if (!c.env.IVR_SECRET || params.k !== c.env.IVR_SECRET) return c.text("forbidden", 403);
  const db = new SupabaseDb(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const settings = await loadSettings(db);
  const out = await handleIvr({ db, env: c.env, settings }, params);
  return c.text(out, 200, { "Content-Type": "text/plain; charset=utf-8" });
});

/** שכונות לפי עיר — להשלמה אוטומטית בטפסים (ציבורי, ללא נתונים רגישים) */
app.get("/api/neighborhoods", async (c) => {
  const city = c.req.query("city") || "";
  const db = new SupabaseDb(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const n = normalize(city);
  const rows = n ? (await db.list("neighborhoods", { limit: 20000 })).filter((x) => x.approved !== false && normalize(x.city) === n) : [];
  return c.json({ items: rows.map((x) => x.name).sort((a: string, b: string) => a.localeCompare(b, "he")) }, 200, { "Cache-Control": "public, max-age=300" });
});

app.route("/admin", admin);
app.route("/", pub);

export default {
  fetch: app.fetch,
  async scheduled(_e: ScheduledController, env: Env) {
    const db = new SupabaseDb(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    await db.removeOlderThan("sessions", "updated_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  },
};
