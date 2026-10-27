import { Hono } from "hono";
import type { Env, Row } from "./types";
import { loadSettings, calcFee } from "./settings";
import { esc, publicPage, ROLE, STYLE, stars, badge, badgeHtml, rng, avatar, icon, citiesData, wizard, daysView, hoursView, hh } from "./ui";
import { fmtDate, fmtTime } from "./hebrew";
import { autoOffer, fillOpenRequests } from "./auto";
import { sendTzintuk } from "./yemot";
import { budgetFor } from "./match";
import { db, cityList, proSections, proFromForm, reqSections, reqFromForm, newToken } from "./admin_web";

/** דפים ציבוריים: הרשמה עצמית, בקשה, דף אישי ללקוח ולבעל מקצוע. בלי סיסמה — הגישה לפי קישור אישי. */
export const pub = new Hono<{ Bindings: Env }>();


// ───────────── הגנה מספאם: שדה מלכודת, זמן מילוי מינימלי, והגבלת קצב לכתובת ─────────────

const antiSpam = (ts = Date.now()) =>
  `<div class="hp" aria-hidden="true"><label>אל תמלאו שדה זה<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div><input type="hidden" name="ts" value="${ts}">`;

const PRO_STEPS: [string, string][] = [["פרטים", "ספרו לנו על עצמכם"], ["מיקום", "איפה אתם נותנים שירות?"], ["זמינות", "מתי אתם זמינים ובכמה?"], ["פרופיל", "עוד כמה פרטים ללקוחות"]];
const REQ_STEPS: [string, string][] = [["הלקוח", "פרטי הקשר שלכם"], ["האירוע", "מה האירוע?"], ["מקום", "איפה האירוע?"], ["תקציב", "תקציב ופרטים אחרונים"]];

async function spamBlocked(c: { env: Env; req: any }, f: Row, kind: string): Promise<string | null> {
  if (f.website) return "בקשה לא תקינה";
  const age = Date.now() - Number(f.ts || 0);
  if (!(age >= 3000 && age <= 24 * 3600 * 1000)) return "הטופס מולא מהר מדי או שפג תוקפו. נסו שוב.";
  const d = db(c);
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const limit = Number((await loadSettings(d)).public_rate_limit || 8);
  const since = Date.now() - 3600 * 1000;
  const hits = (await d.list("public_hits", { match: { ip }, limit: 200 })).filter((h) => new Date(h.created_at).getTime() > since);
  if (hits.length >= limit) return "יותר מדי פניות מהכתובת שלכם. נסו שוב בעוד שעה.";
  await d.insert("public_hits", { ip, kind });
  return null;
}

const fail = (c: any, msg: string, back = "/") =>
  c.html(publicPage("לא ניתן להמשיך", `<div class="card warn">${esc(msg)}</div><p><a class="btn" href="${back}">חזרה</a></p>`), 400);

const validPhone = (v: string) => /^0\d{8,9}$/.test(v);
const validTime = (v: string) => /^([01]\d|2[0-3])[0-5]\d$/.test(v);

// ───────────── דף הבית ─────────────

pub.get("/", (c) =>
  c.html(publicPage("", `<div class="hero"><h1>מוצאים אורגניסט או זמר מושלם לאירוע</h1>
<p>המערכת מתאימה אוטומטית בין בעלי מקצוע לאירועים לפי מיקום, מחיר ואיכות.</p>
<a class="btn big" href="/request">${icon("cal", 22)} אני מחפש אורגניסט או זמר לאירוע</a>
<a class="btn big green" href="/join">${icon("music", 22)} אני אורגניסט או זמר — הרשמה</a></div>
<p class="muted" style="text-align:center">יש כבר דף אישי? היכנסו מהקישור ששמרתם.</p>`)));

// ───────────── הרשמת בעל מקצוע ─────────────

const terms = `<p class="muted">בלחיצה על הכפתור אתם מאשרים את תנאי המערכת ואת תשלום העמלה על עסקה שנסגרה דרכה.</p>`;

pub.get("/join", async (c) => {
  const secs = proSections({ days: [1, 2, 3, 4, 5, 6], role: "organist", style: "both" }, false);
  secs[secs.length - 1].h += terms;
  return c.html(publicPage("הרשמת בעל מקצוע", citiesData((await cityList(db(c))).map((x) => x.name)) +
    wizard("/join", PRO_STEPS, secs.map((x) => x.h), "הרשמה ✓", antiSpam())));
});

pub.post("/join", async (c) => {
  const f = await c.req.parseBody({ all: true });
  const blocked = await spamBlocked(c, f, "join");
  if (blocked) return fail(c, blocked, "/join");
  const d = db(c);
  const phone = String(f.phone || "").replace(/\D/g, "");
  const row = await proFromForm(d, f, false);
  if (!validPhone(phone)) return fail(c, "מספר הטלפון אינו תקין.", "/join");
  if (!String(row.name).trim() || String(row.name).length > 80) return fail(c, "יש למלא שם.", "/join");
  if (!row.city_name) return fail(c, "יש לבחור עיר.", "/join");
  if (!row.days.length) return fail(c, "יש לבחור לפחות יום אחד.", "/join");
  if (!row.hours.length || row.hours.some((h: Row) => !validTime(h.start) || !validTime(h.end))) return fail(c, "יש למלא חלון שעות תקין.", "/join");
  if (row.min_price < 0 || row.min_price > 100000) return fail(c, "הסכום אינו תקין.", "/join");
  row.contact_phones = (row.contact_phones as string[]).filter(validPhone);
  if (!row.contact_phones.length) row.contact_phones = [phone];

  const old = await d.get("professionals", { phone });
  const saved = await d.upsert("professionals", { phone, public_token: old?.public_token || newToken(), active: old?.active ?? true, ...row }, "phone");
  await fillOpenRequests(d, c.env, await loadSettings(d));
  return c.redirect(`/p/${saved.public_token}?new=1`);
});

// ───────────── בקשה של לקוח ─────────────

pub.get("/request", async (c) => {
  const secs = reqSections({ need: "organist", style: "both" }, false);
  secs[secs.length - 1].h += terms;
  return c.html(publicPage("בקשת אורגניסט או זמר", citiesData((await cityList(db(c))).map((x) => x.name)) +
    wizard("/request", REQ_STEPS, secs.map((x) => x.h), "שליחת הבקשה ✓", antiSpam())));
});

pub.post("/request", async (c) => {
  const f = await c.req.parseBody({ all: true });
  const blocked = await spamBlocked(c, f, "request");
  if (blocked) return fail(c, blocked, "/request");
  const d = db(c);
  const row = await reqFromForm(d, f, false);
  const today = new Date().toISOString().slice(0, 10);
  if (!validPhone(row.client_phone)) return fail(c, "מספר הטלפון אינו תקין.", "/request");
  if (!row.client_name.trim()) return fail(c, "יש למלא שם.", "/request");
  if (!row.city_name) return fail(c, "יש לבחור עיר.", "/request");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.event_date) || row.event_date < today) return fail(c, "תאריך האירוע אינו תקין או שעבר.", "/request");
  if (!validTime(row.start_time) || !validTime(row.end_time)) return fail(c, "שעות האירוע אינן תקינות.", "/request");
  if (!(row.max_organist > 0) || row.max_organist > 100000) return fail(c, "יש למלא תקציב לאורגניסט.", "/request");
  row.contact_phones = (row.contact_phones as string[]).filter(validPhone);
  if (!row.contact_phones.length) row.contact_phones = [row.client_phone];
  row.notes = String(row.notes).slice(0, 600);

  await d.upsert("clients", { phone: row.client_phone, name: row.client_name }, "phone");
  const made = await d.insert("requests", { ...row, status: "open", public_token: newToken() });
  await autoOffer(d, c.env, await loadSettings(d), made);
  return c.redirect(`/r/${made.public_token}`);
});

// ───────────── דף אישי ללקוח: ההצעות ואישור ─────────────

async function revealContact(settings: Row, pro: Row): Promise<string> {
  if (settings.payment_enabled !== "true" && settings.reveal_contact_without_payment === "true") {
    const phones = (pro.contact_phones?.length ? pro.contact_phones : [pro.phone]) as string[];
    return `<div class="card ok"><b>${esc(pro.name || "בעל המקצוע")}</b> אושר. ליצירת קשר:
<div class="row" style="margin-top:8px">${phones.map((p) => `<a class="btn" dir="ltr" href="tel:${esc(p)}">📞 ${esc(p)}</a>`).join("")}</div></div>`;
  }
  return `<div class="card ok">ההצעה של ${esc(pro.name || "בעל המקצוע")} אושרה. פרטי הקשר ימסרו לאחר התשלום.</div>`;
}

pub.get("/r/:token", async (c) => {
  const d = db(c);
  const [r, settings] = await Promise.all([d.get("requests", { public_token: c.req.param("token") }), loadSettings(d)]);
  if (!r) return c.html(publicPage("לא נמצא", `<div class="card">הקישור אינו תקין.</div>`), 404);
  const offers = (await d.list("offers", { match: { request_id: r.id } })).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
  const pros = new Map((await d.list("professionals", { limit: 10000 })).map((p: Row) => [p.id, p]));

  const head = `<div class="card"><div class="row">${badge(esc(r.city_name) + (r.neighborhood ? ", " + esc(r.neighborhood) : ""), "brand")}${badgeHtml(`${esc(fmtDate(r.event_date))} · ${rng(r.start_time, r.end_time)}`)}${badge(STYLE[r.style] || "")}</div>
<div class="muted" style="margin-top:8px">תקציב: ${esc(r.max_organist)}₪${r.max_singer ? ` + ${esc(r.max_singer)}₪ לזמר` : ""}</div></div>`;

  const cards = offers.map((o, idx) => {
    const p = pros.get(o.pro_id);
    if (!p) return "";
    const accepted = o.status === "accepted";
    return `<div class="card${accepted ? " ok" : ""}"><div class="offer"><div class="who">${avatar(p.name)}</div>
<div><b style="font-size:18px">${esc(p.name || "בעל מקצוע")}</b> ${idx === 0 && !accepted ? badge("ההתאמה הטובה ביותר", "ok") : ""}
<div>${stars(p.rating)} <span class="score">${ROLE[p.role] || ""} · ${STYLE[p.style] || ""}${p.neighborhood ? " · " + esc(p.neighborhood) : ""}</span></div>
${p.bio ? `<small>${esc(p.bio)}</small>` : ""}</div>
<div class="act" style="text-align:center"><div class="price">${esc(o.amount)}₪</div>
${accepted ? badge("✓ אושרה", "ok") : `<form method="post" action="/r/${r.public_token}/accept"><input type="hidden" name="offer_id" value="${o.id}"><button class="sm">אני מאשר</button></form>`}</div></div></div>`;
  }).join("");

  let contacts = "";
  for (const o of offers.filter((x) => x.status === "accepted")) { const p = pros.get(o.pro_id); if (p) contacts += await revealContact(settings, p); }

  return c.html(publicPage("ההצעות שלכם", head + contacts + (cards || `<div class="card warn">כרגע לא נמצאו בעלי מקצוע מתאימים. ההצעות יופיעו כאן אוטומטית כשיצטרפו בעלי מקצוע מתאימים. שמרו את הקישור הזה.</div>`) +
    `<p class="muted">ההצעות מדורגות לפי איכות, מחיר וקרבה. שמרו את הקישור הזה כדי לחזור לדף.</p>`));
});

pub.post("/r/:token/accept", async (c) => {
  const d = db(c);
  const f = await c.req.parseBody();
  const r = await d.get("requests", { public_token: c.req.param("token") });
  if (!r) return c.text("לא נמצא", 404);
  const o = await d.get("offers", { id: String(f.offer_id || "") });
  if (o && o.request_id === r.id && o.status !== "accepted") {
    const settings = await loadSettings(d);
    const fee = calcFee(o.amount, settings);
    await d.update("offers", { id: o.id }, { status: "accepted", fee_client: fee.client, fee_pro: fee.pro });
    const pro = await d.get("professionals", { id: o.pro_id });
    if (pro) await sendTzintuk(c.env, settings, [pro.phone]);
  }
  return c.redirect(`/r/${r.public_token}?saved=1`);
});

// ───────────── דף אישי לבעל מקצוע ─────────────

pub.get("/p/:token", async (c) => {
  const d = db(c);
  const [p, settings] = await Promise.all([d.get("professionals", { public_token: c.req.param("token") }), loadSettings(d)]);
  if (!p) return c.html(publicPage("לא נמצא", `<div class="card">הקישור אינו תקין.</div>`), 404);
  const offers = (await d.list("offers", { match: { pro_id: p.id }, order: "created_at.desc" }));
  const reqs = new Map((await d.list("requests", { limit: 5000 })).map((r: Row) => [r.id, r]));
  const over = Number(settings.over_budget_percent || 15);

  const rows = offers.map((o) => {
    const r = reqs.get(o.request_id);
    if (!r) return "";
    const acc = o.status === "accepted";
    return `<div class="card${acc ? " ok" : ""}"><div class="row"><b>${esc(r.city_name)}</b>${badgeHtml(`${esc(fmtDate(r.event_date))} · ${rng(r.start_time, r.end_time)}`)}${badge(STYLE[r.style] || "")}<span class="sp"></span>${acc ? badge("✓ אושרה", "ok") : badge("ממתין לאישור הלקוח", "warn")}</div>
<small>תקציב ${budgetFor(p.role, r, over)}₪ · ההצעה שלכם ${esc(o.amount)}₪ ${o.auto ? "(נשלחה אוטומטית)" : ""}</small>
${acc ? `<div style="margin-top:8px"><b>${esc(r.client_name || "")}</b> <a class="btn sm" dir="ltr" href="tel:${esc((r.contact_phones || [r.client_phone])[0])}">📞 ${esc((r.contact_phones || [r.client_phone]).join(", "))}</a></div>` : ""}</div>`;
  }).join("");

  return c.html(publicPage(`שלום ${p.name || ""}`, `${c.req.query("new") ? `<div class="card ok"><b>נרשמתם בהצלחה!</b> שמרו את הקישור הזה, הוא הדף האישי שלכם.</div>` : ""}
<div class="card"><div class="row">${badge(ROLE[p.role] || "", "brand")}${badge(esc(p.city_name))}${badge(STYLE[p.style] || "")}${badge(`מינימום ${esc(p.min_price)}₪`)}${stars(p.rating)}</div>
<div class="row" style="margin-top:12px">${daysView(p.days)}${hoursView(p.hours)}</div>
<div class="row" style="margin-top:14px">${p.active ? badge("פעיל — מקבלים בקשות", "ok") : badge("מושהה", "warn")}
<form method="post" action="/p/${p.public_token}/pause" class="inline"><button class="ghost sm">${p.active ? "השהיית קבלת בקשות" : "חידוש קבלת בקשות"}</button></form>
<a class="btn ghost sm" href="/p/${p.public_token}/edit">עריכת הפרטים</a></div></div>
<h2>הצעות שנשלחו בשמכם</h2>${rows || `<div class="card empty-state">עוד אין הצעות. כשתגיע בקשה מתאימה, היא תופיע כאן.</div>`}`));
});

pub.post("/p/:token/pause", async (c) => {
  const d = db(c);
  const p = await d.get("professionals", { public_token: c.req.param("token") });
  if (p) await d.update("professionals", { id: p.id }, { active: !p.active });
  return c.redirect(`/p/${c.req.param("token")}?saved=1`);
});

pub.get("/p/:token/edit", async (c) => {
  const d = db(c);
  const p = await d.get("professionals", { public_token: c.req.param("token") });
  if (!p) return c.html(publicPage("לא נמצא", `<div class="card">הקישור אינו תקין.</div>`), 404);
  const secs = proSections(p, false).map((x) => `<div class="sec"><h3>${icon(x.i)}${x.t}</h3>${x.h}</div>`).join("");
  return c.html(publicPage("עריכת פרטים", citiesData((await cityList(d)).map((x) => x.name)) + `<form method="post" action="/p/${p.public_token}/edit" class="card">${secs}<div class="row"><button>שמירה</button><a class="btn ghost" href="/p/${p.public_token}">ביטול</a></div></form>`));
});

pub.post("/p/:token/edit", async (c) => {
  const d = db(c);
  const f = await c.req.parseBody({ all: true });
  const p = await d.get("professionals", { public_token: c.req.param("token") });
  if (!p) return c.text("לא נמצא", 404);
  const row = await proFromForm(d, f, false);
  row.contact_phones = (row.contact_phones as string[]).filter(validPhone);
  if (!row.contact_phones.length) row.contact_phones = [p.phone];
  await d.update("professionals", { id: p.id }, row);
  await fillOpenRequests(d, c.env, await loadSettings(d));
  return c.redirect(`/p/${p.public_token}?saved=1`);
});
