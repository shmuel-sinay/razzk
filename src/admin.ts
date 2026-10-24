import { Hono } from "hono";
import type { Env, Row } from "./types";
import { SupabaseDb } from "./db";
import { DEFAULTS, loadSettings } from "./settings";
import { normalize } from "./hebrew";

export const admin = new Hono<{ Bindings: Env }>();

const esc = (v: any) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

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

const db = (c: { env: Env }) => new SupabaseDb(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

const NAV = [
  ["", "סקירה"], ["settings", "הגדרות והודעות"], ["pros", "בעלי מקצוע"], ["clients", "לקוחות"],
  ["requests", "בקשות"], ["offers", "הצעות"], ["messages", "הודעות למנהלים"], ["partners", "שותפים"], ["cities", "ערים"],
];

function page(title: string, body: string): string {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — ניהול</title>
<style>
body{font-family:system-ui,Arial,sans-serif;margin:0;background:#f5f6f8;color:#1c1e21}
nav{background:#1f3a5f;padding:10px 16px;display:flex;flex-wrap:wrap;gap:6px}
nav a{color:#fff;text-decoration:none;padding:6px 10px;border-radius:6px;font-size:15px}
nav a:hover{background:#2f5388}
main{max-width:1000px;margin:20px auto;padding:0 16px}
h1{font-size:22px} table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid #e4e6ea;text-align:right;font-size:14px;vertical-align:top}
th{background:#eef1f6}
input[type=text],textarea,select{width:100%;box-sizing:border-box;padding:7px;border:1px solid #c5cad3;border-radius:6px;font:inherit}
textarea{min-height:70px}
button{background:#1f3a5f;color:#fff;border:0;padding:8px 16px;border-radius:6px;font:inherit;cursor:pointer}
button.d{background:#b3261e} .card{background:#fff;padding:14px;border-radius:8px;margin-bottom:12px}
.k{display:inline-block;background:#fff;border-radius:8px;padding:14px 22px;margin:0 0 10px 10px;text-align:center}
.k b{display:block;font-size:26px} small{color:#666}
</style></head><body>
<nav>${NAV.map(([p, l]) => `<a href="/admin/${p}">${l}</a>`).join("")}</nav>
<main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}

function table(cols: [string, string][], rows: Row[], extra?: (r: Row) => string): string {
  return `<table><tr>${cols.map(([, h]) => `<th>${h}</th>`).join("")}${extra ? "<th></th>" : ""}</tr>${rows
    .map((r) => `<tr>${cols.map(([k]) => `<td>${esc(typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k])}</td>`).join("")}${extra ? `<td>${extra(r)}</td>` : ""}</tr>`)
    .join("")}</table>`;
}

const delBtn = (table: string, id: string) =>
  `<form method="post" action="/admin/delete" onsubmit="return confirm('למחוק?')"><input type="hidden" name="table" value="${table}"><input type="hidden" name="id" value="${id}"><button class="d">מחיקה</button></form>`;

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

const search = (rows: Row[], q: string) =>
  q ? rows.filter((r) => JSON.stringify(Object.values(r)).includes(q)) : rows;
const searchBox = (path: string, q: string) =>
  `<form method="get" action="/admin/${path}" style="margin-bottom:10px"><input type="text" name="q" value="${esc(q)}" placeholder="חיפוש לפי שם, טלפון או עיר" style="max-width:320px"> <button>חיפוש</button></form>`;
const toggleBtn = (tbl: string, id: string, field: string, to: boolean, label: string) =>
  `<form method="post" action="/admin/toggle"><input type="hidden" name="table" value="${tbl}"><input type="hidden" name="id" value="${id}"><input type="hidden" name="field" value="${field}"><input type="hidden" name="to" value="${to}"><button>${label}</button></form>`;

admin.get("/pros", async (c) => {
  const q = c.req.query("q") || "";
  const rows = search(await db(c).list("professionals", { order: "created_at.desc", limit: 1000 }), q);
  return c.html(page("בעלי מקצוע", searchBox("pros", q) + table(
    [["name", "שם"], ["phone", "טלפון"], ["role", "תפקיד"], ["city_name", "עיר"], ["style", "סגנון"], ["days", "ימים"], ["hours", "שעות"], ["min_price", "מינימום"], ["active", "פעיל"]],
    rows, (r) => `<a href="/admin/pros/${r.id}"><button>עריכה</button></a>` + toggleBtn("professionals", r.id, "active", !r.active, r.active ? "השבתה" : "הפעלה") + delBtn("professionals", r.id),
  )));
});

admin.get("/pros/:id", async (c) => {
  const r = await db(c).get("professionals", { id: c.req.param("id") });
  if (!r) return c.text("לא נמצא", 404);
  const f = (k: string, label: string, v: any) => `<p><label><b>${label}</b><br><input type="text" name="${k}" value="${esc(v)}"></label></p>`;
  return c.html(page("עריכת בעל מקצוע", `<form method="post" class="card">
${f("name", "שם", r.name)}${f("age", "גיל", r.age)}${f("city_name", "עיר", r.city_name)}${f("min_price", "סכום מינימלי", r.min_price)}
${f("contact_phones", "טלפונים לקבלת הזמנות (מופרדים בפסיק)", (r.contact_phones || []).join(","))}
<p><label><b>סגנון</b><br><select name="style">${["hasidic:חסידי", "mizrahi:מזרחי", "both:שניהם"].map((o) => { const [v, l] = o.split(":"); return `<option value="${v}"${r.style === v ? " selected" : ""}>${l}</option>`; }).join("")}</select></label></p>
<p><label><input type="checkbox" name="has_pa" value="1"${r.has_pa ? " checked" : ""}> יש הגברה</label> &nbsp; <label><input type="checkbox" name="active" value="1"${r.active ? " checked" : ""}> פעיל</label></p>
<p><small>טלפון הרישום: ${esc(r.phone)} · תפקיד: ${esc(r.role)} · ימים: ${esc(JSON.stringify(r.days))} · שעות: ${esc(JSON.stringify(r.hours))}</small></p>
<button>שמירה</button></form>`));
});

admin.post("/pros/:id", async (c) => {
  const f = await c.req.parseBody();
  await db(c).update("professionals", { id: c.req.param("id") }, {
    name: String(f.name || ""), age: Number(f.age) || null, city_name: String(f.city_name || ""),
    min_price: Number(f.min_price) || 0, style: String(f.style),
    contact_phones: String(f.contact_phones || "").split(",").map((x) => x.trim()).filter(Boolean),
    has_pa: f.has_pa === "1", active: f.active === "1",
  });
  return c.redirect("/admin/pros");
});

admin.get("/clients", async (c) => {
  const q = c.req.query("q") || "";
  const rows = search(await db(c).list("clients", { order: "created_at.desc", limit: 1000 }), q);
  return c.html(page("לקוחות", searchBox("clients", q) + table([["name", "שם"], ["phone", "טלפון"], ["created_at", "נרשם"]], rows, (r) => delBtn("clients", r.id))));
});

admin.get("/requests", async (c) => {
  const q = c.req.query("q") || "";
  const rows = search(await db(c).list("requests", { order: "created_at.desc", limit: 1000 }), q);
  return c.html(page("בקשות", searchBox("requests", q) + table(
    [["client_name", "לקוח"], ["client_phone", "טלפון"], ["need", "מבוקש"], ["city_name", "עיר"], ["hall_name", "אולם"], ["event_date", "תאריך"], ["start_time", "מ"], ["end_time", "עד"], ["max_organist", "תקציב אורגניסט"], ["max_singer", "תקציב זמר"], ["status", "סטטוס"]],
    rows, (r) => toggleBtn("requests", r.id, "status", r.status !== "open", r.status === "open" ? "סגירה" : "פתיחה מחדש") + delBtn("requests", r.id))));
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
