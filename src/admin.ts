import { Hono } from "hono";
import type { Env, Row } from "./types";
import { SupabaseDb } from "./db";
import { DEFAULTS, loadSettings } from "./settings";
import { normalize, fmtDate, fmtTime } from "./hebrew";
import {
  esc, page, table, delBtn, ROLE, STYLE, avatar, badge, stars, daysView, hoursView, icon, yesNo, filterBox,
  fld, text, area, sec, cityCombo, citiesData,
} from "./ui";
import { web } from "./admin_web";
import { REGIONS } from "./regions";
import { SEED } from "./neighborhoods_seed";

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
    ? "טבלה חסרה במסד הנתונים. יש להריץ את קבצי supabase/migrations."
    : "";
  return c.html(page("שגיאה", `<div class="card warn"><p><b>${esc(hint || "אירעה שגיאה")}</b></p><pre style="direction:ltr;white-space:pre-wrap">${esc(msg.slice(0, 600))}</pre></div>`), 500);
});

const db = (c: { env: Env }) => new SupabaseDb(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

// טפסי הוספה/עריכה והתאמות (חייבים להירשם לפני נתיבים עם פרמטר)
admin.route("/", web);

const search = (rows: Row[], q: string) => (q ? rows.filter((r) => JSON.stringify(Object.values(r)).includes(q)) : rows);
const searchBox = (path: string, q: string) =>
  `<form method="get" action="/admin/${path}" class="row"><input type="search" name="q" value="${esc(q)}" placeholder="חיפוש לפי שם, טלפון או עיר" style="max-width:320px"><button class="ghost">חיפוש</button></form>`;
const toggleBtn = (tbl: string, id: string, field: string, to: boolean, label: string, cls = "ghost sm") =>
  `<form method="post" action="/admin/toggle" class="inline"><input type="hidden" name="table" value="${tbl}"><input type="hidden" name="id" value="${id}"><input type="hidden" name="field" value="${field}"><input type="hidden" name="to" value="${to}"><button class="${cls}">${label}</button></form>`;
const phone = (p: any) => `<span dir="ltr">${esc(p)}</span>`;

// ───────────── סקירה ─────────────

admin.get("/", async (c) => {
  const d = db(c);
  const today = new Date().toISOString().slice(0, 10);
  const [pros, clients, reqs, offers, msgs] = await Promise.all(["professionals", "clients", "requests", "offers", "admin_messages"].map((t) => d.list(t, { limit: 10000 })));
  const open = reqs.filter((r) => r.status === "open" && r.event_date >= today);
  const accepted = offers.filter((o) => o.status === "accepted");
  const fees = accepted.reduce((s, o) => s + (o.fee_client || 0) + (o.fee_pro || 0), 0);
  const kpi = (n: any, l: string, ic: string) => `<div class="kpi"><span>${icon(ic, 18)} ${l}</span><b>${n}</b></div>`;
  const recent = [...reqs].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6);
  return c.html(page("סקירה", `<div class="kpis">${kpi(pros.filter((p) => p.active).length, "בעלי מקצוע פעילים", "music")}${kpi(open.length, "בקשות פתוחות", "cal")}${kpi(offers.length, "הצעות", "offer")}${kpi(accepted.length, "הצעות שאושרו", "heart")}${kpi(fees.toLocaleString("he-IL") + "₪", "עמלות (מאושרות)", "money")}${kpi(msgs.filter((m) => !m.handled).length, "הודעות שלא טופלו", "mail")}</div>
<div class="toolbar"><a class="btn" href="/admin/requests/new">${icon("plus", 18)} בקשה חדשה</a><a class="btn ghost" href="/admin/pros/new">${icon("plus", 18)} בעל מקצוע חדש</a><a class="btn ghost" href="/join" target="_blank">דף הרשמה ציבורי ↗</a><a class="btn ghost" href="/request" target="_blank">דף בקשה ציבורי ↗</a></div>
<h2>בקשות אחרונות</h2>${table([
    ["client_name", "לקוח", (r) => `<div class="who">${avatar(r.client_name)}<div><b>${esc(r.client_name)}</b><small>${esc(r.city_name)}</small></div></div>`],
    ["event_date", "מועד", (r) => `${fmtDate(r.event_date)} <small dir="ltr" style="text-align:right">${fmtTime(r.start_time)}–${fmtTime(r.end_time)}</small>`],
    ["status", "סטטוס", (r) => badge(r.status === "open" ? "פתוחה" : "סגורה", r.status === "open" ? "ok" : "")],
  ], recent, (r) => `<a class="btn sm" href="/admin/requests/${r.id}">התאמות</a>`)}`, ""));
});

// ───────────── הגדרות ─────────────

admin.get("/settings", async (c) => {
  const s = await loadSettings(db(c));
  const groups: Record<string, string> = {};
  for (const [k, meta] of Object.entries(DEFAULTS)) {
    const bool = meta.value === "true" || meta.value === "false";
    const long = meta.value.length > 60;
    const ctl = bool
      ? `<select name="${k}"><option value="true"${s[k] === "true" ? " selected" : ""}>כן</option><option value="false"${s[k] !== "true" ? " selected" : ""}>לא</option></select>`
      : long ? area(k, s[k]) : text(k, s[k]);
    groups[meta.group] = (groups[meta.group] || "") + fld(meta.label, ctl);
  }
  const body = Object.entries(groups).map(([g, h]) => `<div class="card"><h2>${g}</h2>${h}</div>`).join("");
  return c.html(page("הגדרות והודעות", `<form method="post">${body}<div class="row"><button>שמירה</button></div></form>`));
});

admin.post("/settings", async (c) => {
  const f = await c.req.parseBody();
  const d = db(c);
  for (const k of Object.keys(DEFAULTS)) if (typeof f[k] === "string") await d.upsert("settings", { key: k, value: f[k] }, "key");
  return c.redirect("/admin/settings?saved=1");
});

// ───────────── בעלי מקצוע ─────────────

admin.get("/pros", async (c) => {
  const q = c.req.query("q") || "";
  const rows = search(await db(c).list("professionals", { order: "created_at.desc", limit: 1000 }), q);
  return c.html(page("בעלי מקצוע", `<div class="toolbar"><a class="btn" href="/admin/pros/new">${icon("plus", 18)} הוספת בעל מקצוע</a>${searchBox("pros", q)}</div>` + table([
    ["name", "בעל מקצוע", (r) => `<div class="who">${avatar(r.name || r.phone)}<div><b>${esc(r.name || "ללא שם")}</b><small>${phone(r.phone)}</small></div></div>`],
    ["role", "תפקיד", (r) => `${badge(ROLE[r.role] || r.role, "brand")}<small>${STYLE[r.style] || ""}</small>`],
    ["city_name", "אזור", (r) => `${esc(r.city_name)}${r.neighborhood ? `<small>${esc(r.neighborhood)}</small>` : ""}${r.region ? `<small>${badge(REGIONS[r.region]?.label || r.region)}</small>` : ""}`],
    ["days", "זמינות", (r) => `${daysView(r.days)}<div style="margin-top:4px">${hoursView(r.hours)}</div>`],
    ["min_price", "מחיר", (r) => `<b>${esc(r.min_price)}₪</b><small>${stars(r.rating ?? 3)}</small>`],
    ["active", "סטטוס", (r) => (r.active ? badge("פעיל", "ok") : badge("מושהה", "warn"))],
  ], rows, (r) => `<a class="btn sm" href="/admin/pros/${r.id}">עריכה</a>` + toggleBtn("professionals", r.id, "active", !r.active, r.active ? "השבתה" : "הפעלה") + delBtn("professionals", r.id))));
});

// ───────────── לקוחות ובקשות ─────────────

admin.get("/clients", async (c) => {
  const q = c.req.query("q") || "";
  const rows = search(await db(c).list("clients", { order: "created_at.desc", limit: 1000 }), q);
  return c.html(page("לקוחות", searchBox("clients", q) + `<div style="height:12px"></div>` + table([
    ["name", "לקוח", (r) => `<div class="who">${avatar(r.name || r.phone)}<div><b>${esc(r.name || "ללא שם")}</b><small>${phone(r.phone)}</small></div></div>`],
    ["created_at", "נרשם", (r) => esc(String(r.created_at || "").slice(0, 10))],
  ], rows, (r) => delBtn("clients", r.id))));
});

admin.get("/requests", async (c) => {
  const q = c.req.query("q") || "";
  const rows = search(await db(c).list("requests", { order: "created_at.desc", limit: 1000 }), q);
  return c.html(page("בקשות", `<div class="toolbar"><a class="btn" href="/admin/requests/new">${icon("plus", 18)} בקשה חדשה</a>${searchBox("requests", q)}</div>` + table([
    ["client_name", "לקוח", (r) => `<div class="who">${avatar(r.client_name || r.client_phone)}<div><b>${esc(r.client_name)}</b><small>${phone(r.client_phone)}</small></div></div>`],
    ["event_date", "אירוע", (r) => `<b>${fmtDate(r.event_date)}</b><small dir="ltr" style="text-align:right">${fmtTime(r.start_time)}–${fmtTime(r.end_time)}</small>`],
    ["city_name", "מקום", (r) => `${esc(r.city_name)}<small>${esc([r.neighborhood, r.hall_name].filter(Boolean).join(" · "))}</small>`],
    ["need", "מבוקש", (r) => `${badge(r.need === "organist" ? "אורגניסט" : "אורגניסט וזמר", "brand")}<small>${STYLE[r.style] || ""}</small>`],
    ["max_organist", "תקציב", (r) => `<b>${esc(r.max_organist)}₪</b>${r.max_singer ? `<small>זמר ${esc(r.max_singer)}₪</small>` : ""}`],
    ["status", "סטטוס", (r) => badge(r.status === "open" ? "פתוחה" : "סגורה", r.status === "open" ? "ok" : "")],
  ], rows, (r) => `<a class="btn sm" href="/admin/requests/${r.id}">התאמות</a>` + toggleBtn("requests", r.id, "status", r.status !== "open", r.status === "open" ? "סגירה" : "פתיחה מחדש") + delBtn("requests", r.id))));
});

admin.get("/offers", async (c) => {
  const d = db(c);
  const [offers, pros, reqs] = await Promise.all([
    d.list("offers", { order: "created_at.desc", limit: 500 }), d.list("professionals", { limit: 5000 }), d.list("requests", { limit: 5000 }),
  ]);
  const pn = new Map(pros.map((p: Row) => [p.id, p.name || p.phone]));
  const rq = new Map(reqs.map((r: Row) => [r.id, r]));
  const rows = offers.map((o: Row) => ({ ...o, pro: pn.get(o.pro_id) || "", r: rq.get(o.request_id) }));
  return c.html(page("הצעות", table([
    ["r", "בקשה", (o) => (o.r ? `<a href="/admin/requests/${o.r.id}"><b>${esc(o.r.client_name || o.r.client_phone)}</b></a><small>${esc(o.r.city_name)} · ${fmtDate(o.r.event_date)}</small>` : "")],
    ["pro", "בעל מקצוע", (o) => `<b>${esc(o.pro)}</b>`],
    ["amount", "סכום", (o) => `<b>${esc(o.amount)}₪</b>`],
    ["status", "סטטוס", (o) => `${o.status === "accepted" ? badge("✓ אושרה", "ok") : badge("נשלחה")}${o.auto ? ` ${badge("אוטומטית", "brand")}` : ""}${o.score ? `<small>ציון ${esc(o.score)}</small>` : ""}`],
    ["fee", "עמלה", (o) => (o.status === "accepted" ? `לקוח ${esc(o.fee_client)}₪<small>בעל מקצוע ${esc(o.fee_pro)}₪</small>` : "—")],
  ], rows, (o) => delBtn("offers", o.id))));
});

admin.get("/messages", async (c) =>
  c.html(page("הודעות למנהלים", `<p class="muted">ההקלטות נמצאות בקו בימות המשיח, בתיקיית ההקלטות, בשם הקובץ המוצג.</p>` +
    table([
      ["phone", "טלפון", (r) => phone(r.phone)],
      ["audio", "קובץ הקלטה", (r) => `<span dir="ltr">${esc(r.audio)}</span>`],
      ["created_at", "זמן", (r) => esc(String(r.created_at || "").slice(0, 16).replace("T", " "))],
      ["handled", "סטטוס", (r) => (r.handled ? badge("טופל", "ok") : badge("חדשה", "warn"))],
    ], await db(c).list("admin_messages", { order: "created_at.desc", limit: 300 }), (r) => toggleBtn("admin_messages", r.id, "handled", !r.handled, r.handled ? "סימון כלא טופל" : "סימון כטופל") + delBtn("admin_messages", r.id)))));

admin.get("/partners", async (c) =>
  c.html(page("שותפים", table([
    ["code", "קוד", (r) => `<b style="font-size:18px;letter-spacing:2px">${esc(r.code)}</b>`],
    ["phone", "טלפון", (r) => phone(r.phone)],
    ["bank", "בנק", (r) => `${esc(r.bank)}-${esc(r.branch)}-${esc(r.account)}`],
    ["active", "סטטוס", (r) => yesNo(r.active)],
  ], await db(c).list("partners", { order: "created_at.desc", limit: 300 }), (r) => delBtn("partners", r.id)))));

// ───────────── ערים ─────────────

admin.get("/cities", async (c) => {
  const n = (await db(c).list("cities", { limit: 10000 })).length;
  return c.html(page("ערים", `<div class="card"><p>במאגר כרגע <b>${n}</b> ערים וישובים.</p>
<form method="post" action="/admin/cities/sync"><button>סנכרון מאגר הערים הממשלתי (data.gov.il)</button></form></div>`));
});

admin.post("/cities/sync", async (c) => {
  const url = "https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=3000";
  const res = await fetch(url);
  if (!res.ok) return c.html(page("ערים", `<div class="card warn">הסנכרון נכשל (${res.status}).</div>`), 502);
  const j: any = await res.json();
  const names: string[] = [...new Set<string>(j.result.records.map((r: Row) => String(r["שם_ישוב"] || "").trim()).filter((x: string) => x && x !== "לא רשום"))];
  const d = db(c);
  const have = new Set((await d.list("cities", { limit: 10000 })).map((r: Row) => r.name));
  await d.insertMany("cities", names.filter((n) => !have.has(n)).map((name) => ({ name, normalized: normalize(name) })));
  return c.redirect("/admin/cities?saved=1");
});

// ───────────── שכונות ─────────────

admin.get("/neighborhoods", async (c) => {
  const d = db(c);
  const city = c.req.query("city") || "";
  const [all, cities] = await Promise.all([d.list("neighborhoods", { limit: 20000 }), d.list("cities", { limit: 10000 })]);
  const pending = all.filter((x) => x.approved === false);
  const byCity = new Map<string, number>();
  for (const x of all) byCity.set(x.city, (byCity.get(x.city) || 0) + 1);
  const rows = (city ? all.filter((x) => normalize(x.city) === normalize(city)) : all).sort((a, b) => a.city.localeCompare(b.city, "he") || a.name.localeCompare(b.name, "he"));
  const chips = [...byCity.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `<a class="badge${normalize(k) === normalize(city) ? " brand" : ""}" href="/admin/neighborhoods?city=${encodeURIComponent(k)}">${esc(k)} · ${n}</a>`).join(" ");
  return c.html(page("שכונות", `${citiesData(cities.map((x: Row) => x.name))}
<div class="card"><p>מאגר השכונות מזין את ההשלמה האוטומטית בטפסים (לפי העיר שנבחרה). שכונה שמישהו מקליד בדף הציבורי ואינה ברשימה נשמרת כממתינה לאישורכם.</p>
<div class="row">${chips || '<span class="muted">עוד אין שכונות במאגר</span>'}</div></div>
${pending.length ? `<div class="card warn"><h3>ממתינות לאישור (${pending.length})</h3>${pending.map((x) => `<div class="row" style="margin-bottom:6px"><b>${esc(x.name)}</b>${badge(x.city)}${toggleBtn("neighborhoods", x.id, "approved", true, "אישור", "sm green")}${delBtn("neighborhoods", x.id)}</div>`).join("")}</div>` : ""}
<div class="card"><h3>הוספת שכונה</h3><form method="post" action="/admin/neighborhoods/add" class="row" style="align-items:flex-end"><div class="fld" style="min-width:220px;margin:0"><label>עיר</label>${cityCombo("city", city, true)}</div><div class="fld" style="min-width:220px;margin:0"><label>שכונה</label>${text("name", "", "required")}</div><button>הוספה</button></form></div>
<div class="card"><h3>ייבוא רשימה</h3><form method="post" action="/admin/neighborhoods/import"><p class="muted">שורה לכל שכונה, בצורה <b>עיר: שכונה</b> (או עיר, שכונה). אפשר להדביק רשימה גדולה.</p>${area("lines", "", 'placeholder="ירושלים: רמות א׳&#10;בית שמש: רמת בית שמש ג׳"')}<div class="row" style="margin-top:10px"><button>ייבוא</button></div></form>
<form method="post" action="/admin/neighborhoods/seed" style="margin-top:12px"><button class="ghost">טעינת רשימת הבסיס (ירושלים, בני ברק, בית שמש, אשדוד, פתח תקווה)</button></form></div>
${filterBox("hoods", "סינון מהיר...")}<div style="height:10px"></div>
${table([["city", "עיר"], ["name", "שכונה", (r) => `<b>${esc(r.name)}</b>`], ["approved", "סטטוס", (r) => (r.approved === false ? badge("ממתינה", "warn") : badge("מאושרת", "ok"))]], rows, (r) => delBtn("neighborhoods", r.id), "hoods")}`));
});

async function addHoods(d: SupabaseDb, pairs: [string, string][]): Promise<number> {
  const have = new Set((await d.list("neighborhoods", { limit: 20000 })).map((x: Row) => `${normalize(x.city)}|${normalize(x.name)}`));
  const fresh: Row[] = [];
  for (const [city, name] of pairs) {
    const k = `${normalize(city)}|${normalize(name)}`;
    if (!city.trim() || !name.trim() || have.has(k)) continue;
    have.add(k);
    fresh.push({ city: city.trim(), name: name.trim() });
  }
  if (fresh.length) await d.insertMany("neighborhoods", fresh);
  return fresh.length;
}

admin.post("/neighborhoods/add", async (c) => {
  const f = await c.req.parseBody();
  await addHoods(db(c), [[String(f.city || ""), String(f.name || "")]]);
  return c.redirect(`/admin/neighborhoods?city=${encodeURIComponent(String(f.city || ""))}&saved=1`);
});

admin.post("/neighborhoods/import", async (c) => {
  const f = await c.req.parseBody();
  const pairs = String(f.lines || "").split(/\r?\n/).map((l) => l.split(/[:,\t|]/).map((x) => x.trim())).filter((p) => p.length >= 2).map((p): [string, string] => [p[0], p.slice(1).join(", ")]);
  await addHoods(db(c), pairs);
  return c.redirect("/admin/neighborhoods?saved=1");
});

admin.post("/neighborhoods/seed", async (c) => {
  await addHoods(db(c), Object.entries(SEED).flatMap(([city, list]) => list.map((n): [string, string] => [city, n])));
  return c.redirect("/admin/neighborhoods?saved=1");
});

// ───────────── מחיקה והחלפת סטטוס ─────────────

const ALLOWED = new Set(["professionals", "clients", "requests", "offers", "admin_messages", "partners", "neighborhoods"]);

admin.post("/delete", async (c) => {
  const f = await c.req.parseBody();
  if (ALLOWED.has(String(f.table))) await db(c).remove(String(f.table), { id: String(f.id) });
  return c.redirect(c.req.header("referer") || "/admin");
});

const TOGGLE_FIELDS = new Set(["active", "status", "handled", "approved"]);

admin.post("/toggle", async (c) => {
  const f = await c.req.parseBody();
  const field = String(f.field || "active");
  if (ALLOWED.has(String(f.table)) && TOGGLE_FIELDS.has(field)) {
    const value = field === "status" ? (f.to === "true" ? "closed" : "open") : f.to === "true";
    await db(c).update(String(f.table), { id: String(f.id) }, { [field]: value });
  }
  return c.redirect(c.req.header("referer") || "/admin");
});
