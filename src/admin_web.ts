import { Hono } from "hono";
import type { Env, Row } from "./types";
import { SupabaseDb } from "./db";
import { loadSettings, calcFee } from "./settings";
import { normalize, fmtDate, fmtTime } from "./hebrew";
import { proMatches, budgetFor } from "./match";
import { autoOffer, fillOpenRequests, scorePro } from "./auto";
import { REGIONS } from "./regions";
import {
  esc, page, table, ROLE, STYLE, avatar, badge, badgeHtml, rng, stars, daysView, hoursView, icon, yesNo, delBtn,
  fld, text, tel, area, dateField, sec, segmented, dayPills, switchBox, timeSelect, readTime, windowsEditor,
  money, ratingInput, cityCombo, hoodCombo, citiesData, wizard,
} from "./ui";

/** טפסי הוספה ועריכה, והתאמות (שידוכים) — הכול דרך האתר */
export const web = new Hono<{ Bindings: Env }>();

export const db = (c: { env: Env }) => new SupabaseDb(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
export const newToken = () => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
export const hhmm = (t: string) => (t || "").replace(":", "").padStart(4, "0").slice(0, 4);
const arr = (v: any): string[] => (Array.isArray(v) ? v.map(String) : v === undefined ? [] : [String(v)]);

export async function cityList(d: SupabaseDb): Promise<Row[]> {
  return d.list("cities", { limit: 10000 });
}

function resolveCity(cities: Row[], name: string): { id: number | null; name: string } {
  const n = normalize(name);
  const hit = cities.find((c) => normalize(c.name) === n);
  return { id: hit?.id ?? null, name: hit?.name ?? name.trim() };
}

export const warnCity = (id: any, name: string) =>
  name && !id ? `<div class="card warn">⚠️ העיר "${esc(name)}" לא נמצאה במאגר הערים, ולכן לא תותאם אוטומטית. בחרו עיר מהרשימה.</div>` : "";

/** שכונה חדשה שהוקלדה נשמרת בצד (בציבורי — ממתינה לאישור מנהל) כדי שהמאגר יגדל */
async function learnHood(d: SupabaseDb, city: string, hood: string, approved: boolean) {
  const name = hood.trim();
  if (!city || !name || name.length > 60) return;
  try {
    const have = (await d.list("neighborhoods", { match: { city }, limit: 5000 })).some((x) => normalize(x.name) === normalize(name));
    if (!have) await d.insert("neighborhoods", { city, name, approved });
  } catch { /* טבלה חסרה או כפילות — לא מונע שמירה */ }
}

const phonesInputs = (phones: string[] = []) =>
  `<div class="grid">${[0, 1, 2].map((i) => `<div class="fld">${tel(`cp${i}`, phones[i] || "")}</div>`).join("")}</div>`;
const readPhones = (f: Row): string[] =>
  [0, 1, 2].map((i) => String(f[`cp${i}`] || "")).concat(String(f.contact_phones || "").split(","))
    .map((x) => x.replace(/\D/g, "")).filter(Boolean);

// ───────────── טופס בעל מקצוע (משותף לניהול ולדף הציבורי) ─────────────

export interface Section { t: string; i: string; h: string }

export function proSections(r: Row, admin: boolean): Section[] {
  const personal =
    `<div class="grid">${fld("טלפון (מזהה)", tel("phone", r.phone, r.id ? "readonly" : "required"))}${fld("שם ומשפחה", text("name", r.name, "required"))}${fld("גיל", `<input type="number" name="age" value="${esc(r.age)}" min="14" max="99" inputmode="numeric">`)}</div>` +
    fld("תפקיד", segmented("role", [["organist", "אורגניסט", "נגינה בלבד"], ["organist_singer", "אורגניסט וזמר", "נגינה ושירה"], ["singer", "זמר", "שירה בלבד"]], r.role || "organist", true)) +
    fld("סגנון נגינה", segmented("style", [["hasidic", "חסידי"], ["mizrahi", "מזרחי"], ["both", "שני הסגנונות"]], r.style || "both"));
  const place =
    `<div class="grid">${fld("עיר או ישוב", cityCombo("city_name", r.city_name, true))}${fld("שכונה", hoodCombo("neighborhood", "city_name", r.neighborhood), "אפשר לבחור מהרשימה או להקליד שכונה אחרת")}</div>` +
    fld("אזור שירות", segmented("region", [["", "רק העיר שלי"], ...Object.entries(REGIONS).map(([k, v]) => [k, v.label] as [string, string])], r.region || ""), "בחירה באזור מאפשרת לקבל בקשות מכל הערים שבו") +
    fld("ערים נוספות לשירות", text("extra_cities", (r.extra_cities || []).join(", "), 'placeholder="למשל: פתח תקווה, בני ברק"'), "מופרדות בפסיק");
  const when =
    fld("ימי זמינות", dayPills("days", r.days || [])) +
    fld("שעות זמינות", windowsEditor(r.hours || [], "h"), "אפשר לקבוע עד שלושה חלונות. סיום אחרי חצות נתמך, למשל 21:00 עד 01:00.") +
    `<div class="grid">${fld("סכום מינימלי לאירוע", money("min_price", r.min_price ?? ""))}<div class="fld"><label>הגברה</label>${switchBox("has_pa", "יש לי הגברה משלי", !!r.has_pa)}</div></div>`;
  const profile =
    fld("על ההתמקצעות שלי", area("bio", r.bio, 'maxlength="600" placeholder="ניסיון, סגנון, אירועים שניגנתי בהם..."'), "יוצג ללקוחות") +
    fld("טלפונים לקבלת הזמנות", phonesInputs(r.contact_phones || []), "אם לא ימולאו, ישמש מספר הרישום") +
    fld("מוכן לשלוח הקלטת נגינה במייל ללקוח?", segmented("email_recording", [["yes", "כן"], ["no", "לא"], ["maybe", "אם יהיה זמין"]], r.email_recording || "maybe")) +
    `<div class="fld">${switchBox("tzintuk_ok", "אני מאשר קבלת צינתוקים מהמערכת", !!r.tzintuk_ok)}</div>` +
    (admin ? `<div class="grid">${fld("דירוג איכות", ratingInput("rating", r.rating ?? 3), "משפיע על סדר ההצעות")}<div class="fld"><label>סטטוס</label>${switchBox("active", "פעיל — מקבל בקשות", r.active ?? true)}</div></div>${fld("הערות פנימיות", area("notes", r.notes))}` : "");
  return [
    { t: "פרטים", i: "user", h: personal },
    { t: "מיקום", i: "map", h: place },
    { t: "זמינות", i: "clock", h: when },
    { t: "פרופיל", i: "music", h: profile },
  ];
}

const stack = (s: Section[]) => s.map((x) => sec(x.t, x.i, x.h)).join("");

function proFormPage(r: Row, cities: Row[], action: string, title: string): string {
  return page(title, `${citiesData(cities.map((c) => c.name))}${warnCity(r.city_id, r.city_name)}<form method="post" action="${action}" class="card" data-wizard-off>${stack(proSections(r, true))}<div class="row"><button>שמירה</button><a class="btn ghost" href="/admin/pros">ביטול</a></div></form>`, "pros");
}

export async function proFromForm(d: SupabaseDb, f: Row, admin = true): Promise<Row> {
  const cities = await cityList(d);
  const city = resolveCity(cities, String(f.city_name || ""));
  const hours = [0, 1, 2]
    .map((i) => ({ start: readTime(f, `hs${i}`), end: readTime(f, `he${i}`) }))
    .filter((h) => h.start && h.end);
  const hood = String(f.neighborhood || "").trim().slice(0, 60);
  await learnHood(d, city.name, hood, admin);
  return {
    role: String(f.role || "organist"), name: String(f.name || "").trim(), age: Number(f.age) || null,
    city_id: city.id, city_name: city.name, neighborhood: hood,
    region: REGIONS[String(f.region)] ? String(f.region) : null,
    extra_cities: String(f.extra_cities || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8).map((x) => resolveCity(cities, x).name),
    style: String(f.style || "both"), days: arr(f.days).map(Number).filter((n) => n >= 1 && n <= 7).sort(), hours,
    bio: String(f.bio || "").slice(0, 600), has_pa: f.has_pa === "1", tzintuk_ok: f.tzintuk_ok === "1",
    ...(admin ? { active: f.active === "1", rating: Math.max(1, Math.min(5, Number(f.rating) || 3)), notes: String(f.notes || "") } : {}),
    min_price: Number(f.min_price) || 0,
    contact_phones: readPhones(f),
    email_recording: String(f.email_recording || "maybe"),
  };
}

web.get("/pros/new", async (c) => c.html(proFormPage({ active: true, days: [1, 2, 3, 4, 5, 6], role: "organist", style: "both", rating: 3 }, await cityList(db(c)), "/admin/pros/new", "הוספת בעל מקצוע")));

web.post("/pros/new", async (c) => {
  const f = await c.req.parseBody({ all: true });
  const d = db(c);
  const phone = String(f.phone || "").replace(/\D/g, "");
  if (!phone) return c.html(page("שגיאה", `<div class="card warn">חובה למלא טלפון.</div>`), 400);
  const old = await d.get("professionals", { phone });
  const row = await d.upsert("professionals", { phone, public_token: old?.public_token || newToken(), ...(await proFromForm(d, f)) }, "phone");
  await fillOpenRequests(d, c.env, await loadSettings(d));
  return c.redirect(`/admin/pros/${row.id}?saved=1`);
});

web.get("/pros/:id", async (c) => {
  const d = db(c);
  const r = await d.get("professionals", { id: c.req.param("id") });
  if (!r) return c.text("לא נמצא", 404);
  const link = r.public_token ? `<div class="card flat"><b>הדף האישי של בעל המקצוע:</b> <a href="/p/${r.public_token}" target="_blank">/p/${r.public_token}</a></div>` : "";
  return c.html(proFormPage(r, await cityList(d), `/admin/pros/${r.id}`, "עריכת בעל מקצוע").replace('<form method="post"', `${link}<form method="post"`));
});

web.post("/pros/:id", async (c) => {
  const f = await c.req.parseBody({ all: true });
  const d = db(c);
  await d.update("professionals", { id: c.req.param("id") }, await proFromForm(d, f));
  await fillOpenRequests(d, c.env, await loadSettings(d));
  return c.redirect(`/admin/pros/${c.req.param("id")}?saved=1`);
});

// ───────────── בקשה (לקוח + אירוע) ─────────────

export function reqSections(r: Row, _admin = true): Section[] {
  const client = `<div class="grid">${fld("שם הלקוח", text("client_name", r.client_name, "required"))}${fld("טלפון הלקוח", tel("client_phone", r.client_phone, "required"))}</div>`;
  const event =
    fld("מה מבקשים?", segmented("need", [["organist", "אורגניסט", "נגינה בלבד"], ["organist_singer", "אורגניסט וזמר", "נגינה ושירה"]], r.need || "organist", true)) +
    `<div class="grid">${fld("תאריך האירוע", dateField("event_date", r.event_date, true))}${fld("שעת תחילה", timeSelect("start_time", r.start_time || ""))}${fld("שעת סיום", timeSelect("end_time", r.end_time || ""), "סיום אחרי חצות נתמך")}</div>` +
    fld("סגנון נגינה", segmented("style", [["hasidic", "חסידי"], ["mizrahi", "מזרחי"], ["both", "שני הסגנונות"]], r.style || "both"));
  const place =
    `<div class="grid">${fld("עיר או ישוב", cityCombo("city_name", r.city_name, true))}${fld("שכונה", hoodCombo("neighborhood", "city_name", r.neighborhood))}</div>` +
    `<div class="grid">${fld("רחוב", text("street", r.street))}${fld("מספר בניין", text("building", r.building))}${fld("שם האולם", text("hall_name", r.hall_name))}</div>`;
  const budget =
    `<div class="grid">${fld("תקציב מקסימלי לאורגניסט", money("max_organist", r.max_organist ?? ""))}${fld("תקציב מקסימלי לזמר", money("max_singer", r.max_singer ?? ""), "רק אם מבקשים גם זמר")}</div>` +
    `<div class="checks" style="margin-bottom:16px">${switchBox("has_pa", "יש הגברה באולם", !!r.has_pa)}${switchBox("allow_over", "מאשר הצעה החורגת מהתקציב", !!r.allow_over)}${switchBox("tzintuk_ok", "מאשר צינתוקים", !!r.tzintuk_ok)}</div>` +
    fld("טלפונים לקבלת הצעות", phonesInputs(r.contact_phones || []), "אם לא ימולאו, ישמש טלפון הלקוח") +
    fld("הערות", area("notes", r.notes, 'maxlength="600"'));
  return [
    { t: "הלקוח", i: "user", h: client },
    { t: "האירוע", i: "cal", h: event },
    { t: "מקום", i: "map", h: place },
    { t: "תקציב", i: "money", h: budget },
  ];
}

export async function reqFromForm(d: SupabaseDb, f: Row, admin = true): Promise<Row> {
  const cities = await cityList(d);
  const city = resolveCity(cities, String(f.city_name || ""));
  const hood = String(f.neighborhood || "").trim().slice(0, 60);
  await learnHood(d, city.name, hood, admin);
  const phone = String(f.client_phone || "").replace(/\D/g, "");
  const phones = readPhones(f);
  return {
    client_name: String(f.client_name || "").trim(), client_phone: phone,
    need: String(f.need || "organist"), city_id: city.id, city_name: city.name,
    neighborhood: hood, street: String(f.street || "").slice(0, 80), building: String(f.building || "").slice(0, 20),
    hall_name: String(f.hall_name || "").slice(0, 80), style: String(f.style || "both"), event_date: String(f.event_date || ""),
    start_time: readTime(f, "start_time"), end_time: readTime(f, "end_time"),
    has_pa: f.has_pa === "1", allow_over: f.allow_over === "1", tzintuk_ok: f.tzintuk_ok === "1",
    max_organist: Number(f.max_organist) || 0, max_singer: f.max_singer ? Number(f.max_singer) : null,
    contact_phones: phones.length ? phones : phone ? [phone] : [],
    notes: String(f.notes || "").slice(0, 600),
  };
}

function reqFormPage(r: Row, cities: Row[], action: string, title: string): string {
  return page(title, `${citiesData(cities.map((c) => c.name))}${warnCity(r.city_id, r.city_name)}<form method="post" action="${action}" class="card">${stack(reqSections(r))}<div class="row"><button>שמירה</button><a class="btn ghost" href="/admin/requests">ביטול</a></div></form>`, "requests");
}

web.get("/requests/new", async (c) => c.html(reqFormPage({ need: "organist", style: "both" }, await cityList(db(c)), "/admin/requests/new", "בקשה חדשה")));

web.post("/requests/new", async (c) => {
  const f = await c.req.parseBody({ all: true });
  const d = db(c);
  const row = await reqFromForm(d, f);
  if (row.client_phone) await d.upsert("clients", { phone: row.client_phone, name: row.client_name }, "phone");
  const made = await d.insert("requests", { ...row, status: "open", public_token: newToken() });
  await autoOffer(d, c.env, await loadSettings(d), made);
  return c.redirect(`/admin/requests/${made.id}?saved=1`);
});

web.get("/requests/:id/edit", async (c) => {
  const d = db(c);
  const r = await d.get("requests", { id: c.req.param("id") });
  if (!r) return c.text("לא נמצא", 404);
  return c.html(reqFormPage(r, await cityList(d), `/admin/requests/${r.id}/edit`, "עריכת בקשה"));
});

web.post("/requests/:id/edit", async (c) => {
  const f = await c.req.parseBody({ all: true });
  const d = db(c);
  await d.update("requests", { id: c.req.param("id") }, await reqFromForm(d, f));
  return c.redirect(`/admin/requests/${c.req.param("id")}?saved=1`);
});

// ───────────── התאמות (שידוכים) ─────────────

web.get("/requests/:id", async (c) => {
  const d = db(c);
  const [r, settings] = await Promise.all([d.get("requests", { id: c.req.param("id") }), loadSettings(d)]);
  if (!r) return c.text("לא נמצא", 404);
  const over = Number(settings.over_budget_percent || 15);
  const [pros, offers] = await Promise.all([d.list("professionals", { match: { active: true }, limit: 10000 }), d.list("offers", { match: { request_id: r.id }, order: "created_at.desc" })]);
  const offered = new Set(offers.map((o) => o.pro_id));
  const matches = pros.filter((p) => proMatches(p, r, over)).map((p): Row => ({ ...p, _score: scorePro(p, r, settings) })).sort((a: Row, b: Row) => b._score - a._score);
  const byId = new Map(pros.map((p: Row) => [p.id, p]));

  const details = `<div class="card"><div class="row"><div class="who">${avatar(r.client_name || r.client_phone)}<div><b>${esc(r.client_name || r.client_phone)}</b><small dir="ltr" style="text-align:right">${esc(r.client_phone)}</small></div></div><div class="sp"></div>${badge(r.status === "open" ? "פתוחה" : "סגורה", r.status === "open" ? "ok" : "")}</div>
<div class="row" style="margin:14px 0 6px">${badge(r.need === "organist" ? "אורגניסט" : "אורגניסט וזמר", "brand")}${badge(STYLE[r.style] || "")}${badge(esc(r.city_name) + (r.neighborhood ? ", " + esc(r.neighborhood) : ""))}${badgeHtml(`${esc(fmtDate(r.event_date))} · ${rng(r.start_time, r.end_time)}`)}${r.hall_name ? badge(r.hall_name) : ""}${badge(r.has_pa ? "יש הגברה" : "אין הגברה")}</div>
<div class="muted">תקציב: אורגניסט ${esc(r.max_organist)}₪${r.max_singer ? ` · זמר ${esc(r.max_singer)}₪` : ""}${r.allow_over ? ` · חריגה עד ${over}% מאושרת` : ""}</div>
${r.notes ? `<p>${esc(r.notes)}</p>` : ""}
<div class="row" style="margin-top:14px"><a class="btn" href="/admin/requests/${r.id}/edit">עריכת הבקשה</a>
<form method="post" action="/admin/requests/${r.id}/auto" class="inline"><button class="ghost">הפעל התאמה אוטומטית מחדש</button></form>
${r.public_token ? `<a class="btn ghost" href="/r/${r.public_token}" target="_blank">דף הלקוח ↗</a>` : ""}</div></div>${warnCity(r.city_id, r.city_name)}`;

  const cards = matches.map((p) => {
    const budget = budgetFor(p.role, r, over);
    const done = offered.has(p.id);
    return `<div class="card"><div class="offer"><div class="who">${avatar(p.name || p.phone)}</div>
<div><b>${esc(p.name || p.phone)}</b> ${badge(ROLE[p.role] || "", "brand")} ${badge(STYLE[p.style] || "")}<div>${stars(p.rating ?? 3)} <span class="score">ציון התאמה ${p._score}</span></div>
<small>${esc(p.city_name)}${p.neighborhood ? " · " + esc(p.neighborhood) : ""} · מינימום ${esc(p.min_price)}₪ (תקציב ${budget}₪)</small>${p.bio ? `<small>${esc(p.bio)}</small>` : ""}</div>
<div class="act">${done ? badge("נשלחה הצעה", "ok") : `<form method="post" action="/admin/requests/${r.id}/offer" class="row" style="flex-wrap:nowrap"><input type="hidden" name="pro_id" value="${p.id}"><div style="width:120px">${money("amount", p.min_price || budget)}</div><button class="sm">הצע</button></form>`}</div></div></div>`;
  }).join("");

  const offerRows = offers.map((o) => {
    const p = byId.get(o.pro_id);
    const fee = calcFee(o.amount, settings);
    return `<tr><td><b>${esc(p?.name || p?.phone || "")}</b></td><td><b>${esc(o.amount)}₪</b></td><td>${o.status === "accepted" ? badge("✓ אושרה", "ok") : badge("נשלחה")}${o.auto ? ` ${badge("אוטומטית · " + esc(o.score), "brand")}` : ""}</td>
<td><small>עמלה ${fee.total}₪ · לקוח ${fee.client}₪ · בעל מקצוע ${fee.pro}₪</small></td>
<td>${o.status === "accepted" ? `<span dir="ltr">${esc((p?.contact_phones?.length ? p.contact_phones : [p?.phone]).join(", "))}</span>` : `<form method="post" action="/admin/offers/${o.id}/accept" class="inline"><button class="sm green">אישור הצעה</button></form>`}</td></tr>`;
  }).join("");

  return c.html(page("בקשה והתאמות", details +
    `<h2>בעלי מקצוע מתאימים <span class="badge brand">${matches.length}</span></h2>` +
    (matches.length ? cards : `<div class="card warn">לא נמצאו בעלי מקצוע מתאימים כרגע (עיר, יום, שעות, סגנון, הגברה ותקציב). אפשר להוסיף בעלי מקצוע או לעדכן את הבקשה.</div>`) +
    `<h2>הצעות שנשלחו <span class="badge">${offers.length}</span></h2>` +
    (offers.length ? `<div class="tablewrap"><table><thead><tr><th>בעל מקצוע</th><th>סכום</th><th>סטטוס</th><th>עמלה</th><th>פרטי קשר / פעולה</th></tr></thead><tbody>${offerRows}</tbody></table></div>` : `<div class="card empty-state">עוד לא נשלחו הצעות.</div>`), "requests"));
});

web.post("/requests/:id/auto", async (c) => {
  const d = db(c);
  const r = await d.get("requests", { id: c.req.param("id") });
  if (r) await autoOffer(d, c.env, await loadSettings(d), r);
  return c.redirect(`/admin/requests/${c.req.param("id")}?saved=1`);
});

web.post("/requests/:id/offer", async (c) => {
  const f = await c.req.parseBody();
  const amount = Number(f.amount);
  if (!amount || !f.pro_id) return c.redirect(`/admin/requests/${c.req.param("id")}`);
  await db(c).insert("offers", { request_id: c.req.param("id"), pro_id: String(f.pro_id), amount, status: "sent", source: "web" });
  return c.redirect(`/admin/requests/${c.req.param("id")}?saved=1`);
});

web.post("/offers/:id/accept", async (c) => {
  const d = db(c);
  const o = await d.get("offers", { id: c.req.param("id") });
  if (!o) return c.text("לא נמצא", 404);
  const fee = calcFee(o.amount, await loadSettings(d));
  await d.update("offers", { id: o.id }, { status: "accepted", fee_client: fee.client, fee_pro: fee.pro });
  return c.redirect(`/admin/requests/${o.request_id}?saved=1`);
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
    matches: pros.filter((p: Row) => proMatches(p, r, over)).length,
    offers: offers.filter((o: Row) => o.request_id === r.id).length,
    accepted: offers.some((o: Row) => o.request_id === r.id && o.status === "accepted"),
  }));
  return c.html(page("התאמות", `<div class="toolbar"><a class="btn" href="/admin/requests/new">${icon("plus", 18)} בקשה חדשה</a></div>` + table(
    [
      ["client_name", "לקוח", (r) => `<div class="who">${avatar(r.client_name)}<div><b>${esc(r.client_name)}</b><small>${esc(r.city_name)}</small></div></div>`],
      ["when", "מועד", (r) => `<b>${fmtDate(r.event_date)}</b><small dir="ltr" style="text-align:right">${fmtTime(r.start_time)}–${fmtTime(r.end_time)}</small>`],
      ["need", "מבוקש", (r) => badge(r.need === "organist" ? "אורגניסט" : "אורגניסט וזמר", "brand")],
      ["matches", "מתאימים", (r) => badge(String(r.matches), r.matches ? "ok" : "warn")],
      ["offers", "הצעות", (r) => `${badge(String(r.offers))}${r.accepted ? " " + badge("✓ אושרה", "ok") : ""}`],
    ],
    rows, (r) => `<a class="btn sm" href="/admin/requests/${r.id}">התאמות</a>`)));
});
