import { Hono } from "hono";
import type { Env, Row } from "./types";
import { SupabaseDb } from "./db";
import { loadSettings, calcFee } from "./settings";
import { normalize, fmtDate, fmtTime, DAY_NAMES } from "./hebrew";
import { proMatches, budgetFor } from "./match";
import { esc, page, table } from "./ui";

/** טפסי הוספה ועריכה, והתאמות (שידוכים) — הכול דרך האתר */
export const web = new Hono<{ Bindings: Env }>();

const db = (c: { env: Env }) => new SupabaseDb(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

const ROLE: Record<string, string> = { organist: "אורגניסט", organist_singer: "אורגניסט וזמר", singer: "זמר" };
const STYLE: Record<string, string> = { hasidic: "חסידי", mizrahi: "מזרחי", both: "שניהם" };

// ───────────── עזרי טפסים ─────────────

const inp = (name: string, label: string, v: any = "", type = "text", extra = "") =>
  `<p><label><b>${label}</b><br><input type="${type}" name="${name}" value="${esc(v)}" ${extra}></label></p>`;
const sel = (name: string, label: string, opts: [string, string][], cur: any) =>
  `<p><label><b>${label}</b><br><select name="${name}">${opts.map(([v, l]) => `<option value="${v}"${String(cur) === v ? " selected" : ""}>${l}</option>`).join("")}</select></label></p>`;
const chk = (name: string, label: string, on: any, val = "1") =>
  `<label style="margin-left:14px"><input type="checkbox" name="${name}" value="${val}"${on ? " checked" : ""}> ${label}</label>`;
const hhmm = (t: string) => (t || "").replace(":", "").padStart(4, "0").slice(0, 4);
const hh_mm = (t: string) => (t && t.length === 4 ? `${t.slice(0, 2)}:${t.slice(2)}` : "");
const arr = (v: any): string[] => (Array.isArray(v) ? v.map(String) : v === undefined ? [] : [String(v)]);

async function cityList(d: SupabaseDb): Promise<Row[]> {
  return d.list("cities", { limit: 10000 });
}
const cityDatalist = (cities: Row[]) =>
  `<datalist id="cities">${[...new Set(cities.map((x) => x.name))].map((n) => `<option value="${esc(n)}">`).join("")}</datalist>`;

function resolveCity(cities: Row[], name: string): { id: number | null; name: string } {
  const n = normalize(name);
  const hit = cities.find((c) => normalize(c.name) === n);
  return { id: hit?.id ?? null, name: hit?.name ?? name.trim() };
}

const warnCity = (id: any, name: string) =>
  name && !id ? `<div class="card" style="border:1px solid #c98a00">⚠️ העיר "${esc(name)}" לא נמצאה במאגר הערים, ולכן לא תותאם אוטומטית. בחר עיר מהרשימה או סנכרן את הערים.</div>` : "";

// ───────────── בעל מקצוע ─────────────

function proForm(r: Row, cities: Row[], action: string, title: string): string {
  const hours: Row[] = r.hours?.length ? r.hours : [];
  const hr = [0, 1, 2].map((i) => `<p>חלון ${i + 1}: מ- <input type="time" name="hs${i}" value="${esc(hh_mm(hours[i]?.start))}" style="width:auto"> עד <input type="time" name="he${i}" value="${esc(hh_mm(hours[i]?.end))}" style="width:auto"></p>`).join("");
  return page(title, `<form method="post" action="${action}" class="card">
${inp("phone", "טלפון הרישום (מזהה)", r.phone, "text", r.id ? "readonly" : "required")}
${sel("role", "תפקיד", [["organist", "אורגניסט"], ["organist_singer", "אורגניסט וזמר"], ["singer", "זמר"]], r.role || "organist")}
${inp("name", "שם ומשפחה", r.name)}${inp("age", "גיל", r.age, "number")}
<p><label><b>עיר או ישוב</b><br><input type="text" name="city_name" list="cities" value="${esc(r.city_name)}"></label></p>${cityDatalist(cities)}
${inp("neighborhood", "שכונה", r.neighborhood)}
${sel("style", "סגנון נגינה", [["hasidic", "חסידי"], ["mizrahi", "מזרחי"], ["both", "שני הסגנונות"]], r.style || "both")}
<p><b>ימי זמינות</b><br>${[1, 2, 3, 4, 5, 6, 7].map((n) => chk("days", DAY_NAMES[n], (r.days || []).includes(n), String(n))).join("")}</p>
<p><b>שעות זמינות</b> (אפשר עד שלושה חלונות; סיום אחרי חצות נתמך, למשל 21:00 עד 01:00)</p>${hr}
<p><label><b>פרטים על ההתמקצעות</b><br><textarea name="bio">${esc(r.bio)}</textarea></label></p>
<p>${chk("has_pa", "יש הגברה", r.has_pa)} ${chk("tzintuk_ok", "מאשר צינתוקים", r.tzintuk_ok)} ${chk("active", "פעיל", r.active ?? true)}</p>
${inp("min_price", "סכום מינימלי לאירוע (₪)", r.min_price, "number")}
${inp("contact_phones", "טלפונים לקבלת הזמנות (מופרדים בפסיק)", (r.contact_phones || []).join(","))}
${sel("email_recording", "מוכן לשלוח הקלטת נגינה במייל", [["yes", "כן"], ["no", "לא"], ["maybe", "אם יהיה זמין"]], r.email_recording || "maybe")}
<p><label><b>הערות פנימיות</b><br><textarea name="notes">${esc(r.notes)}</textarea></label></p>
<button>שמירה</button></form>`);
}

async function proFromForm(d: SupabaseDb, f: Row): Promise<Row> {
  const city = resolveCity(await cityList(d), String(f.city_name || ""));
  const hours = [0, 1, 2]
    .filter((i) => f[`hs${i}`] && f[`he${i}`])
    .map((i) => ({ start: hhmm(String(f[`hs${i}`])), end: hhmm(String(f[`he${i}`])) }));
  return {
    role: String(f.role), name: String(f.name || ""), age: Number(f.age) || null,
    city_id: city.id, city_name: city.name, neighborhood: String(f.neighborhood || ""),
    style: String(f.style), days: arr(f.days).map(Number).sort(), hours,
    bio: String(f.bio || ""), has_pa: f.has_pa === "1", tzintuk_ok: f.tzintuk_ok === "1", active: f.active === "1",
    min_price: Number(f.min_price) || 0,
    contact_phones: String(f.contact_phones || "").split(",").map((x) => x.trim()).filter(Boolean),
    email_recording: String(f.email_recording || "maybe"), notes: String(f.notes || ""),
  };
}

web.get("/pros/new", async (c) => c.html(proForm({ active: true, days: [1, 2, 3, 4, 5, 6] }, await cityList(db(c)), "/admin/pros/new", "הוספת בעל מקצוע")));

web.post("/pros/new", async (c) => {
  const f = await c.req.parseBody({ all: true });
  const d = db(c);
  const phone = String(f.phone || "").replace(/\D/g, "");
  if (!phone) return c.html(page("שגיאה", `<div class="card">חובה למלא טלפון.</div>`), 400);
  const row = await d.upsert("professionals", { phone, ...(await proFromForm(d, f)) }, "phone");
  return c.redirect(`/admin/pros/${row.id}`);
});

web.get("/pros/:id", async (c) => {
  const d = db(c);
  const r = await d.get("professionals", { id: c.req.param("id") });
  if (!r) return c.text("לא נמצא", 404);
  const warn = warnCity(r.city_id, r.city_name);
  const html = proForm(r, await cityList(d), `/admin/pros/${r.id}`, "עריכת בעל מקצוע");
  return c.html(warn ? html.replace("<form", `${warn}<form`) : html);
});

web.post("/pros/:id", async (c) => {
  const f = await c.req.parseBody({ all: true });
  const d = db(c);
  await d.update("professionals", { id: c.req.param("id") }, await proFromForm(d, f));
  return c.redirect(`/admin/pros/${c.req.param("id")}`);
});

// ───────────── בקשה (לקוח + אירוע) ─────────────

function reqForm(r: Row, cities: Row[], action: string, title: string): string {
  return page(title, `<form method="post" action="${action}" class="card">
<h3>הלקוח</h3>
${inp("client_name", "שם הלקוח", r.client_name)}${inp("client_phone", "טלפון הלקוח", r.client_phone, "text", "required")}
<h3>האירוע</h3>
${sel("need", "מה מבקשים", [["organist", "אורגניסט בלבד"], ["organist_singer", "אורגניסט וזמר"]], r.need || "organist")}
<p><label><b>עיר או ישוב</b><br><input type="text" name="city_name" list="cities" value="${esc(r.city_name)}"></label></p>${cityDatalist(cities)}
${inp("neighborhood", "שכונה", r.neighborhood)}${inp("street", "רחוב", r.street)}${inp("building", "מספר בניין", r.building)}${inp("hall_name", "שם האולם", r.hall_name)}
${sel("style", "סגנון נגינה", [["hasidic", "חסידי"], ["mizrahi", "מזרחי"], ["both", "שני הסגנונות"]], r.style || "both")}
${inp("event_date", "תאריך האירוע", r.event_date, "date", "required")}
<p>שעות: מ- <input type="time" name="start_time" value="${esc(hh_mm(r.start_time))}" required style="width:auto"> עד <input type="time" name="end_time" value="${esc(hh_mm(r.end_time))}" required style="width:auto"></p>
<p>${chk("has_pa", "יש הגברה באולם", r.has_pa)} ${chk("allow_over", "מאשר הצעה החורגת מהתקציב", r.allow_over)} ${chk("tzintuk_ok", "מאשר צינתוקים", r.tzintuk_ok)}</p>
${inp("max_organist", "תקציב מקסימלי לאורגניסט (₪)", r.max_organist, "number")}${inp("max_singer", "תקציב מקסימלי לזמר (₪, אם נדרש)", r.max_singer, "number")}
${inp("contact_phones", "טלפונים לקבלת הצעות (מופרדים בפסיק)", (r.contact_phones || []).join(","))}
<p><label><b>הערות</b><br><textarea name="notes">${esc(r.notes)}</textarea></label></p>
<button>שמירה</button></form>`);
}

async function reqFromForm(d: SupabaseDb, f: Row): Promise<Row> {
  const city = resolveCity(await cityList(d), String(f.city_name || ""));
  return {
    client_name: String(f.client_name || ""), client_phone: String(f.client_phone || "").replace(/\D/g, ""),
    need: String(f.need), city_id: city.id, city_name: city.name,
    neighborhood: String(f.neighborhood || ""), street: String(f.street || ""), building: String(f.building || ""),
    hall_name: String(f.hall_name || ""), style: String(f.style), event_date: String(f.event_date),
    start_time: hhmm(String(f.start_time || "")), end_time: hhmm(String(f.end_time || "")),
    has_pa: f.has_pa === "1", allow_over: f.allow_over === "1", tzintuk_ok: f.tzintuk_ok === "1",
    max_organist: Number(f.max_organist) || 0, max_singer: f.max_singer ? Number(f.max_singer) : null,
    contact_phones: String(f.contact_phones || f.client_phone || "").split(",").map((x) => x.trim()).filter(Boolean),
    notes: String(f.notes || ""),
  };
}

web.get("/requests/new", async (c) => c.html(reqForm({}, await cityList(db(c)), "/admin/requests/new", "בקשה חדשה")));

web.post("/requests/new", async (c) => {
  const f = await c.req.parseBody({ all: true });
  const d = db(c);
  const row = await reqFromForm(d, f);
  if (row.client_phone) await d.upsert("clients", { phone: row.client_phone, name: row.client_name }, "phone");
  const made = await d.insert("requests", { ...row, status: "open" });
  return c.redirect(`/admin/requests/${made.id}`);
});

web.get("/requests/:id/edit", async (c) => {
  const d = db(c);
  const r = await d.get("requests", { id: c.req.param("id") });
  if (!r) return c.text("לא נמצא", 404);
  return c.html(reqForm(r, await cityList(d), `/admin/requests/${r.id}/edit`, "עריכת בקשה"));
});

web.post("/requests/:id/edit", async (c) => {
  const f = await c.req.parseBody({ all: true });
  const d = db(c);
  await d.update("requests", { id: c.req.param("id") }, await reqFromForm(d, f));
  return c.redirect(`/admin/requests/${c.req.param("id")}`);
});

// ───────────── התאמות (שידוכים) ─────────────

web.get("/requests/:id", async (c) => {
  const d = db(c);
  const [r, settings] = await Promise.all([d.get("requests", { id: c.req.param("id") }), loadSettings(d)]);
  if (!r) return c.text("לא נמצא", 404);
  const over = Number(settings.over_budget_percent || 15);
  const [pros, offers] = await Promise.all([d.list("professionals", { match: { active: true }, limit: 10000 }), d.list("offers", { match: { request_id: r.id }, order: "created_at.desc" })]);
  const offered = new Set(offers.map((o) => o.pro_id));
  const matches = pros.filter((p) => proMatches(p, r, over));
  const byId = new Map(pros.map((p) => [p.id, p]));

  const details = `<div class="card"><p><b>${esc(r.client_name || r.client_phone)}</b> · ${esc(r.client_phone)} · ${r.need === "organist" ? "אורגניסט" : "אורגניסט וזמר"}</p>
<p>${esc(r.city_name)}${r.neighborhood ? ", " + esc(r.neighborhood) : ""} · ${esc(r.hall_name || "")} · ${fmtDate(r.event_date)} · ${fmtTime(r.start_time)}–${fmtTime(r.end_time)} · ${STYLE[r.style] || ""}</p>
<p>תקציב: אורגניסט ${esc(r.max_organist)}₪${r.max_singer ? ` · זמר ${esc(r.max_singer)}₪` : ""} · הגברה באולם: ${r.has_pa ? "יש" : "אין"} · סטטוס: ${esc(r.status)}</p>
${warnCity(r.city_id, r.city_name)}
<a href="/admin/requests/${r.id}/edit"><button>עריכת הבקשה</button></a></div>`;

  const matchRows = matches.map((p) => {
    const budget = budgetFor(p.role, r, over);
    const done = offered.has(p.id);
    return `<tr><td>${esc(p.name || p.phone)}<br><small>${esc(p.phone)}</small></td><td>${ROLE[p.role]}</td><td>${STYLE[p.style] || ""}</td>
<td>מינימום ${esc(p.min_price)}₪<br><small>תקציב ${budget}₪</small></td><td><small>${esc(p.bio || "")}</small></td>
<td>${done ? "נשלחה הצעה" : `<form method="post" action="/admin/requests/${r.id}/offer"><input type="hidden" name="pro_id" value="${p.id}"><input type="number" name="amount" value="${esc(p.min_price || budget)}" style="width:90px"> <button>הצע</button></form>`}</td></tr>`;
  }).join("");
  const matchTable = matches.length
    ? `<table><tr><th>בעל מקצוע</th><th>תפקיד</th><th>סגנון</th><th>מחיר</th><th>פרטים</th><th></th></tr>${matchRows}</table>`
    : `<div class="card">לא נמצאו בעלי מקצוע מתאימים כרגע (עיר, יום, שעות, סגנון, הגברה ותקציב). אפשר להוסיף בעלי מקצוע, או לעדכן את הבקשה.</div>`;

  const offerRows = offers.map((o) => {
    const p = byId.get(o.pro_id);
    const fee = calcFee(o.amount, settings);
    return `<tr><td>${esc(p?.name || p?.phone || "")}</td><td>${esc(o.amount)}₪</td><td>${o.status === "accepted" ? "✅ אושרה" : "נשלחה"}</td>
<td>עמלה ${fee.total}₪ (לקוח ${fee.client}₪ · בעל מקצוע ${fee.pro}₪)</td>
<td>${o.status === "accepted" ? `פרטי קשר: ${esc((p?.contact_phones || [p?.phone]).join(", "))}` : `<form method="post" action="/admin/offers/${o.id}/accept"><button>אישור הצעה</button></form>`}</td></tr>`;
  }).join("");

  return c.html(page("בקשה והתאמות", details + `<h3>בעלי מקצוע מתאימים (${matches.length})</h3>${matchTable}<h3>הצעות שנשלחו (${offers.length})</h3>${offers.length ? `<table><tr><th>בעל מקצוע</th><th>סכום</th><th>סטטוס</th><th>עמלה</th><th></th></tr>${offerRows}</table>` : "<p>עוד לא נשלחו הצעות.</p>"}`));
});

web.post("/requests/:id/offer", async (c) => {
  const f = await c.req.parseBody();
  const amount = Number(f.amount);
  if (!amount || !f.pro_id) return c.redirect(`/admin/requests/${c.req.param("id")}`);
  await db(c).insert("offers", { request_id: c.req.param("id"), pro_id: String(f.pro_id), amount, status: "sent", source: "web" });
  return c.redirect(`/admin/requests/${c.req.param("id")}`);
});

web.post("/offers/:id/accept", async (c) => {
  const d = db(c);
  const o = await d.get("offers", { id: c.req.param("id") });
  if (!o) return c.text("לא נמצא", 404);
  const fee = calcFee(o.amount, await loadSettings(d));
  await d.update("offers", { id: o.id }, { status: "accepted", fee_client: fee.client, fee_pro: fee.pro });
  return c.redirect(`/admin/requests/${o.request_id}`);
});

web.get("/matches", async (c) => {
  const d = db(c);
  const settings = await loadSettings(d);
  const over = Number(settings.over_budget_percent || 15);
  const today = new Date().toISOString().slice(0, 10);
  const [reqs, pros, offers] = await Promise.all([
    d.list("requests", { match: { status: "open" }, order: "event_date.asc", limit: 2000 }),
    d.list("professionals", { match: { active: true }, limit: 10000 }),
    d.list("offers", { limit: 10000 }),
  ]);
  const rows = reqs.filter((r) => r.event_date >= today).map((r) => ({
    ...r,
    when: `${fmtDate(r.event_date)} ${fmtTime(r.start_time)}–${fmtTime(r.end_time)}`,
    matches: pros.filter((p) => proMatches(p, r, over)).length,
    offers: offers.filter((o) => o.request_id === r.id).length,
  }));
  return c.html(page("התאמות", `<p><a href="/admin/requests/new"><button>+ בקשה חדשה</button></a></p>` + table(
    [["client_name", "לקוח"], ["city_name", "עיר"], ["when", "מועד"], ["need", "מבוקש"], ["matches", "בעלי מקצוע מתאימים"], ["offers", "הצעות"]],
    rows, (r) => `<a href="/admin/requests/${r.id}"><button>התאמות</button></a>`,
  )));
});
