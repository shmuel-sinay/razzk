import { Hono } from "hono";
import type { Env, Row } from "./types";
import { SupabaseDb } from "./db";
import { DEFAULTS, loadSettings } from "./settings";
import { normalize } from "./hebrew";
import { esc, page, table, delBtn } from "./ui";
import { web } from "./admin_web";

export const admin = new Hono<{ Bindings: Env }>();

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

/** הגנה בסיסמה (Basic Auth). שם המשתמש חופשי. */
admin.use("*", async (c, next) => {
  const want = c.env.ADMIN_PASSWORD;
  const h = c.req.header("authorization") || "";
  if (want && h.startsWith("Basic ")) {
    const pass = atob(h.slice(6)).split(":").slice(1).join(":");
    if (safeEqual(pass, want)) return next();
  }
  return c.text("נדרשת הזדהות", 401, { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' });
});

/** שגיאה קריאה במקום דף ריק: הסיבה השכיחה היא סוד חסר או שגוי ב-Cloudflare */
admin.onError((err, c) => {
  const msg = String(err?.message || err);
  const hint = !c.env.SUPABASE_URL || !c.env.SUPABASE_SERVICE_KEY
    ? "חסר הסוד SUPABASE_URL או SUPABASE_SERVICE_KEY ב-Cloudflare (Settings ← Variables and Secrets)."
    : /401|403|Invalid API key|JWT/i.test(msg)
    ? "מפתח ה-Supabase (SUPABASE_SERVICE_KEY) שגוי. יש להעתיק את מפתח service_role או Secret key מחדש."
    : /404|relation|does not exist/i.test(msg)
    ? "טבלה חסרה במסד הנתונים. יש להריץ את supabase/migrations/001_init.sql."
    : "";
  return c.html(page("שגיאה", `<div class="card"><p><b>${esc(hint || "אירעה שגיאה")}</b></p><pre style="direction:ltr;white-space:pre-wrap">${esc(msg.slice(0, 600))}</pre></div>`), 500);
});

const db = (c: { env: Env }) => new SupabaseDb(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

admin.get("/", async (c) => {
  const d = db(c);
  const counts = await Promise.all(["professionals", "clients", "requests", "offers", "admin_messages"].map(async (t) => (await d.list(t, { limit: 5000 })).length));
  const labels = ["בעלי מקצוע", "לקוחות", "בקשות", "הצעות", "הודעות למנהלים"];
  return c.html(page("סקירה", counts.map((n, i) => `<div class="k"><b>${n}</b>${labels[i]}</div>`).join("")));
});

admin.get("/settings", async (c) => {
  const s = await loadSettings(db(c));
  const groups: Record<string, string> = {};
  for (const [k, meta] of Object.entries(DEFAULTS)) {
    const long = meta.value.length > 60;
    groups[meta.group] = (groups[meta.group] || "") +
      `<p><label><b>${esc(meta.label)}</b><br>${long ? `<textarea name="${k}">${esc(s[k])}</textarea>` : `<input type="text" name="${k}" value="${esc(s[k])}">`}</label></p>`;
  }
  const body = Object.entries(groups).map(([g, h]) => `<div class="card"><h3>${g}</h3>${h}</div>`).join("");
  return c.html(page("הגדרות והודעות", `<form method="post">${body}<button>שמירה</button></form>`));
});

admin.post("/settings", async (c) => {
  const f = await c.req.parseBody();
  const d = db(c);
  for (const k of Object.keys(DEFAULTS)) if (typeof f[k] === "string") await d.upsert("settings", { key: k, value: f[k] }, "key");
  return c.redirect("/admin/settings");
});

// טפסי הוספה/עריכה והתאמות (חייבים להירשם לפני נתיבים עם פרמטר)
admin.route("/", web);

const search = (rows: Row[], q: string) =>
  q ? rows.filter((r) => JSON.stringify(Object.values(r)).includes(q)) : rows;
const searchBox = (path: string, q: string) =>
  `<form method="get" action="/admin/${path}" style="margin-bottom:10px"><input type="text" name="q" value="${esc(q)}" placeholder="חיפוש לפי שם, טלפון או עיר" style="max-width:320px"> <button>חיפוש</button></form>`;
const toggleBtn = (tbl: string, id: string, field: string, to: boolean, label: string) =>
  `<form method="post" action="/admin/toggle"><input type="hidden" name="table" value="${tbl}"><input type="hidden" name="id" value="${id}"><input type="hidden" name="field" value="${field}"><input type="hidden" name="to" value="${to}"><button>${label}</button></form>`;

admin.get("/pros", async (c) => {
  const q = c.req.query("q") || "";
  const rows = search(await db(c).list("professionals", { order: "created_at.desc", limit: 1000 }), q);
  return c.html(page("בעלי מקצוע", `<p><a href="/admin/pros/new"><button>+ הוספת בעל מקצוע</button></a></p>` + searchBox("pros", q) + table(
    [["name", "שם"], ["phone", "טלפון"], ["role", "תפקיד"], ["city_name", "עיר"], ["style", "סגנון"], ["days", "ימים"], ["hours", "שעות"], ["min_price", "מינימום"], ["active", "פעיל"]],
    rows, (r) => `<a href="/admin/pros/${r.id}"><button>עריכה</button></a>` + toggleBtn("professionals", r.id, "active", !r.active, r.active ? "השבתה" : "הפעלה") + delBtn("professionals", r.id),
  )));
});

admin.get("/clients", async (c) => {
  const q = c.req.query("q") || "";
  const rows = search(await db(c).list("clients", { order: "created_at.desc", limit: 1000 }), q);
  return c.html(page("לקוחות", searchBox("clients", q) + table([["name", "שם"], ["phone", "טלפון"], ["created_at", "נרשם"]], rows, (r) => delBtn("clients", r.id))));
});

admin.get("/requests", async (c) => {
  const q = c.req.query("q") || "";
  const rows = search(await db(c).list("requests", { order: "created_at.desc", limit: 1000 }), q);
  return c.html(page("בקשות", `<p><a href="/admin/requests/new"><button>+ בקשה חדשה</button></a></p>` + searchBox("requests", q) + table(
    [["client_name", "לקוח"], ["client_phone", "טלפון"], ["need", "מבוקש"], ["city_name", "עיר"], ["hall_name", "אולם"], ["event_date", "תאריך"], ["start_time", "מ"], ["end_time", "עד"], ["max_organist", "תקציב אורגניסט"], ["max_singer", "תקציב זמר"], ["status", "סטטוס"]],
    rows, (r) => `<a href="/admin/requests/${r.id}"><button>התאמות</button></a>` + toggleBtn("requests", r.id, "status", r.status !== "open", r.status === "open" ? "סגירה" : "פתיחה מחדש") + delBtn("requests", r.id))));
});

admin.get("/offers", async (c) => {
  const d = db(c);
  const [offers, pros, reqs] = await Promise.all([
    d.list("offers", { order: "created_at.desc", limit: 500 }), d.list("professionals", { limit: 5000 }), d.list("requests", { limit: 5000 }),
  ]);
  const pn = new Map(pros.map((p: Row) => [p.id, p.name || p.phone]));
  const rq = new Map(reqs.map((r: Row) => [r.id, `${r.client_name || r.client_phone} · ${r.city_name} · ${r.event_date}`]));
  const rows = offers.map((o: Row) => ({ ...o, pro: pn.get(o.pro_id) || o.pro_id, req: rq.get(o.request_id) || o.request_id }));
  return c.html(page("הצעות", table(
    [["req", "בקשה"], ["pro", "בעל מקצוע"], ["amount", "סכום"], ["status", "סטטוס"], ["fee_client", "עמלת לקוח"], ["fee_pro", "עמלת בעל מקצוע"], ["created_at", "נשלחה"]],
    rows, (r) => delBtn("offers", r.id))));
});

admin.get("/messages", async (c) =>
  c.html(page("הודעות למנהלים", `<p><small>ההקלטות נמצאות בקו בימות המשיח, בתיקיית ההקלטות, בשם הקובץ המוצג.</small></p>` +
    table([["phone", "טלפון"], ["audio", "קובץ הקלטה"], ["created_at", "זמן"], ["handled", "טופל"]],
      await db(c).list("admin_messages", { order: "created_at.desc", limit: 300 }), (r) => toggleBtn("admin_messages", r.id, "handled", !r.handled, r.handled ? "סימון כלא טופל" : "סימון כטופל") + delBtn("admin_messages", r.id)))));

admin.get("/partners", async (c) =>
  c.html(page("שותפים", table([["code", "קוד"], ["phone", "טלפון"], ["bank", "בנק"], ["branch", "סניף"], ["account", "חשבון"], ["active", "פעיל"]],
    await db(c).list("partners", { order: "created_at.desc", limit: 300 }), (r) => delBtn("partners", r.id)))));

admin.get("/cities", async (c) => {
  const n = (await db(c).list("cities", { limit: 10000 })).length;
  return c.html(page("ערים", `<div class="card"><p>במאגר כרגע ${n} ערים וישובים.</p>
<form method="post" action="/admin/cities/sync"><button>סנכרון מאגר הערים הממשלתי (data.gov.il)</button></form></div>`));
});

admin.post("/cities/sync", async (c) => {
  const url = "https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=3000";
  const res = await fetch(url);
  if (!res.ok) return c.html(page("ערים", `<div class="card">הסנכרון נכשל (${res.status}).</div>`), 502);
  const j: any = await res.json();
  const names: string[] = [...new Set<string>(j.result.records.map((r: Row) => String(r["שם_ישוב"] || "").trim()).filter((x: string) => x && x !== "לא רשום"))];
  const d = db(c);
  const have = new Set((await d.list("cities", { limit: 10000 })).map((r: Row) => r.name));
  await d.insertMany("cities", names.filter((n) => !have.has(n)).map((name) => ({ name, normalized: normalize(name) })));
  return c.redirect("/admin/cities");
});

const ALLOWED = new Set(["professionals", "clients", "requests", "offers", "admin_messages", "partners"]);

admin.post("/delete", async (c) => {
  const f = await c.req.parseBody();
  if (ALLOWED.has(String(f.table))) await db(c).remove(String(f.table), { id: String(f.id) });
  return c.redirect(c.req.header("referer") || "/admin");
});

const TOGGLE_FIELDS = new Set(["active", "status", "handled"]);

admin.post("/toggle", async (c) => {
  const f = await c.req.parseBody();
  const field = String(f.field || "active");
  if (ALLOWED.has(String(f.table)) && TOGGLE_FIELDS.has(field)) {
    const value = field === "status" ? (f.to === "true" ? "closed" : "open") : f.to === "true";
    await db(c).update(String(f.table), { id: String(f.id) }, { [field]: value });
  }
  return c.redirect(c.req.header("referer") || "/admin");
});
