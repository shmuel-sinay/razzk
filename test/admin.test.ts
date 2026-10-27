// בדיקת אתר הניהול מקצה לקצה: הזדהות, טפסים, התאמה ושליחת הצעה.
// מחליף את fetch בשרת PostgREST מדומה מעל מסד בזיכרון.
import { admin } from "../src/admin";
import { MemDb } from "./memdb";
import { normalize } from "../src/hebrew";
import { pub } from "../src/public";
import { scorePro } from "../src/auto";
import { DEFAULTS } from "../src/settings";
import { proMatches } from "../src/match";

const mem = new MemDb();
for (const name of ["ירושלים", "בני ברק", "רמת גן", "פתח תקווה", "תל אביב - יפו"]) await mem.insert("cities", { name, normalized: normalize(name) });
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any = {}) => {
  const u = new URL(String(url));
  const table = u.pathname.split("/").pop()!;
  const method = init.method || "GET";
  const match: Record<string, string> = {};
  for (const [k, v] of u.searchParams) if (v.startsWith("eq.")) match[k] = v.slice(3);
  if (method === "GET") {
    const order = u.searchParams.get("order") || undefined;
    let rows = await mem.list(table, { match, order });
    const off = Number(u.searchParams.get("offset") || 0), lim = Number(u.searchParams.get("limit") || 1e9);
    rows = rows.slice(off, off + lim);
    return new Response(JSON.stringify(rows));
  }
  const body = init.body ? JSON.parse(init.body) : undefined;
  if (method === "POST") {
    const on = u.searchParams.get("on_conflict");
    const r = on ? await mem.upsert(table, body, on) : await mem.insert(table, body);
    return new Response(JSON.stringify([r]));
  }
  if (method === "PATCH") await mem.update(table, match, body);
  if (method === "DELETE") await mem.remove(table, match);
  return new Response("[]");
}) as any;

const env: any = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "k", ADMIN_PASSWORD: "pw" };
const auth = { Authorization: "Basic " + btoa("admin:pw") };
let fails = 0;
const check = (ok: boolean, m: string) => { console.log((ok ? "  ✓ " : "  ✗ ") + m); if (!ok) fails++; };
const get = (p: string) => admin.request(p, { headers: auth }, env);
const post = (p: string, fields: [string, string][]) => {
  const body = new URLSearchParams(fields);
  return admin.request(p, { method: "POST", headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" }, body }, env);
};

check((await admin.request("/", {}, env)).status === 401, "בלי סיסמה נחסם");
for (const path of ["/", "/settings", "/pros", "/pros/new", "/clients", "/requests", "/requests/new", "/matches", "/offers", "/messages", "/partners", "/cities"]) {
  const r = await get(path);
  check(r.status === 200 && (await r.text()).includes("<html"), `דף ${path} נטען`);
}

console.log("הוספת בעל מקצוע דרך הטופס");
let r = await post("/pros/new", [
  ["phone", "050-111-1111"], ["role", "organist"], ["name", "דוד כהן"], ["age", "30"], ["city_name", "ירושלים"],
  ["style", "hasidic"], ["days", "1"], ["days", "2"], ["days", "3"], ["hs0", "18:00"], ["he0", "23:00"], ["hs1", ""], ["he1", ""],
  ["has_pa", "1"], ["active", "1"], ["min_price", "800"], ["contact_phones", "0501111111"], ["email_recording", "yes"],
]);
const pro = (await mem.list("professionals"))[0];
check(r.status === 302 && !!pro, "בעל המקצוע נשמר והדף הופנה אליו");
check(pro?.phone === "0501111111" && pro?.city_id != null && pro?.days.length === 3, "טלפון נוקה, העיר נמצאה במאגר, הימים נשמרו");
check(JSON.stringify(pro?.hours) === JSON.stringify([{ start: "1800", end: "2300" }]), "חלון השעות נשמר (חלון ריק נזרק)");

console.log("הוספת בקשה דרך הטופס והתאמה");
r = await post("/requests/new", [
  ["client_name", "משה לוי"], ["client_phone", "0522222222"], ["need", "organist"], ["city_name", "ירושלים"], ["hall_name", "אולם הנרות"],
  ["style", "hasidic"], ["event_date", "2030-01-01"], ["start_time", "20:00"], ["end_time", "23:00"], ["has_pa", "1"], ["max_organist", "1000"],
]);
const req = (await mem.list("requests"))[0];
check(r.status === 302 && !!req && req.start_time === "2000", "הבקשה נשמרה");
const matchPage = await (await get(`/requests/${req.id}`)).text();
check(matchPage.includes("דוד כהן") && matchPage.includes("בעלי מקצוע מתאימים (1)"), "בעל המקצוע מוצע כהתאמה");
check((await (await get("/matches")).text()).includes("משה לוי"), "הבקשה מופיעה ברשימת ההתאמות");

console.log("הצעה אוטומטית ואישור");
const offer = (await mem.list("offers"))[0]!;
check(offer?.auto === true && offer?.amount === 800 && offer?.score > 0, "נוצרה הצעה אוטומטית עם ציון, במחיר המינימלי של בעל המקצוע");
await post(`/offers/${offer.id}/accept`, []);
const acc = (await mem.list("offers"))[0]!;
check(acc.status === "accepted" && acc.fee_client === 80, "הצעה אושרה והעמלה חושבה");
check((await (await get(`/requests/${req.id}`)).text()).includes("0501111111"), "פרטי הקשר מוצגים אחרי אישור");
await post(`/requests/${req.id}/offer`, [["pro_id", pro.id], ["amount", "900"]]);
check((await mem.list("offers")).some((o: any) => o.source === "web" && o.amount === 900), "אפשר גם להצעה ידנית מהאתר");

console.log("בקשה בעיר אחרת לא מותאמת");
await post("/requests/new", [["client_name", "דני"], ["client_phone", "0533333333"], ["need", "organist"], ["city_name", "אילת"], ["style", "hasidic"], ["event_date", "2030-01-01"], ["start_time", "20:00"], ["end_time", "23:00"], ["has_pa", "1"], ["max_organist", "1000"]]);
const req2 = (await mem.list("requests"))[1];
check((await (await get(`/requests/${req2.id}`)).text()).includes("בעלי מקצוע מתאימים (0)"), "אין התאמה לעיר אחרת");
check((await (await get(`/requests/${req2.id}`)).text()).includes("לא נמצאה במאגר"), "אזהרה על עיר שלא במאגר");

console.log("עריכת בעל מקצוע");
r = await post(`/pros/${pro.id}`, [["phone", "0501111111"], ["role", "organist"], ["name", "דוד לוי"], ["city_name", "ירושלים"], ["style", "both"], ["min_price", "700"], ["active", "1"]]);
check((await mem.list("professionals"))[0].name === "דוד לוי" && (await mem.list("professionals"))[0].min_price === 700, "העריכה נשמרה");


console.log("דפים ציבוריים והתאמה אוטומטית");
const pget = (p: string) => pub.request(p, {}, env);
const ppost = (p: string, fields: [string, string][], ip = "1.1.1.1") =>
  pub.request(p, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "cf-connecting-ip": ip }, body: new URLSearchParams(fields) }, env);
const old = String(Date.now() - 10_000);

check((await pget("/")).status === 200 && (await pget("/join")).status === 200 && (await pget("/request")).status === 200, "דפי הבית, ההרשמה והבקשה נטענים בלי סיסמה");
check((await ppost("/join", [["phone", "0504444444"], ["name", "בוט"], ["ts", String(Date.now())]])).status === 400, "מילוי מהיר מדי נחסם");
check((await ppost("/join", [["phone", "0504444444"], ["name", "בוט"], ["website", "spam"], ["ts", old]])).status === 400, "שדה המלכודת חוסם בוטים");

// בעלי מקצוע ציבוריים: אחד עם דירוג גבוה ואחד זול ופחות מדורג
const proFields = (phone: string, name: string, price: string): [string, string][] => [
  ["phone", phone], ["role", "organist"], ["name", name], ["age", "30"], ["city_name", "ירושלים"], ["style", "hasidic"],
  ["days", "1"], ["days", "2"], ["days", "3"], ["hs0", "18:00"], ["he0", "23:00"], ["has_pa", "1"], ["min_price", price], ["contact_phones", phone], ["ts", old],
];
let j = await ppost("/join", proFields("0505555555", "יעקב טוב", "950"), "2.2.2.2");
check(j.status === 302 && String(j.headers.get("location")).startsWith("/p/"), "הרשמה ציבורית עברה והופנתה לדף אישי");
await ppost("/join", proFields("0506666666", "אבי זול", "400"), "3.3.3.3");
await ppost("/join", proFields("0507777777", "שלישי", "700"), "4.4.4.4");
await ppost("/join", proFields("0508888888", "רביעי", "600"), "5.5.5.5");
const all = await mem.list("professionals");
const jacob = all.find((x: any) => x.phone === "0505555555")!;
await mem.update("professionals", { id: jacob.id }, { rating: 5 });
const avi = all.find((x: any) => x.phone === "0506666666")!;
await mem.update("professionals", { id: avi.id }, { rating: 2 });
const s = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, v.value]));
const reqForScore = { max_organist: 1000, allow_over: false, neighborhood: "" };
check(scorePro({ rating: 5, min_price: 950, role: "organist" }, reqForScore, s) !== scorePro({ rating: 2, min_price: 400, role: "organist" }, reqForScore, s), "ציון ההתאמה מחשב איכות ומחיר");

// בקשה ציבורית: נוצרות הצעות אוטומטית, לפחות לבעלי המקצוע המתאימים הטובים ביותר (עד 3)
const before = (await mem.list("offers")).length;
const rq = await ppost("/request", [
  ["client_name", "אברהם"], ["client_phone", "0529999999"], ["need", "organist"], ["city_name", "ירושלים"], ["style", "hasidic"],
  ["event_date", "2031-03-02"], ["start_time", "20:00"], ["end_time", "23:00"], ["has_pa", "1"], ["max_organist", "1200"], ["ts", old],
], "6.6.6.6");
const loc = String(rq.headers.get("location"));
check(rq.status === 302 && loc.startsWith("/r/"), "בקשה ציבורית נשמרה והופנתה לדף אישי");
const newOffers = (await mem.list("offers")).slice(before);
check(newOffers.length === 3 && newOffers.every((o: any) => o.auto), "נוצרו בדיוק 3 הצעות אוטומטיות (המגבלה בהגדרות)");
check(newOffers[0] && newOffers.map((o: any) => Number(o.score)).every((x: number) => x > 0), "לכל הצעה ציון");
const page1 = await (await pget(loc)).text();
check(page1.includes("ההצעות שלכם") && page1.includes("אני מאשר את ההצעה"), "דף הלקוח מציג הצעות עם כפתור אישור");
check(page1.includes("יעקב טוב") && !page1.includes("אבי זול"), "נבחרו הטובים ביותר: הדירוג הגבוה מופיע, והזול עם הדירוג הנמוך לא");
check(!page1.includes("0505555555"), "פרטי הקשר לא נחשפים לפני אישור");

const firstOffer = newOffers[0];
await ppost(`${loc}/accept`, [["offer_id", firstOffer.id]]);
const accepted = (await mem.list("offers")).find((o: any) => o.id === firstOffer.id)!;
check(accepted.status === "accepted" && accepted.fee_client > 0, "אישור ההצעה מהדף הציבורי חישב עמלה");
check((await (await pget(loc)).text()).includes("הטלפון של"), "אחרי אישור מוצגים פרטי הקשר");

const tok = (await mem.list("professionals")).find((x: any) => x.phone === "0505555555")!.public_token;
const pp = await (await pget(`/p/${tok}`)).text();
check(pp.includes("שלום יעקב טוב") && pp.includes("הצעות שנשלחו"), "הדף האישי של בעל המקצוע נטען");
await ppost(`/p/${tok}/pause`, []);
check((await mem.list("professionals")).find((x: any) => x.phone === "0505555555")!.active === false, "בעל מקצוע יכול להשהות את עצמו");

check((await pget("/r/not-a-token")).status === 404 && (await pget("/p/not-a-token")).status === 404, "קישור שגוי מחזיר 404");
let limited = 0;
for (let i = 0; i < 10; i++) { const x = await ppost("/join", [["phone", "12"], ["ts", old]], "9.9.9.9"); if (x.status === 400 && (await x.text()).includes("יותר מדי")) limited++; }
check(limited > 0, "הגבלת קצב לכתובת עובדת");


console.log("אזורי שירות (גוש דן) וערים נוספות");
const base = { active: true, role: "organist", style: "both", days: [1, 2, 3, 4, 5, 6], hours: [{ start: "1000", end: "2300" }], has_pa: true, min_price: 500 };
const reqRG = { city_name: "רמת גן", style: "hasidic", event_date: "2031-03-02", start_time: "2000", end_time: "2200", has_pa: true, max_organist: 1000, need: "organist" };
check(proMatches({ ...base, city_name: "בני ברק", region: "gush_dan" }, reqRG), "בעל מקצוע מבני ברק עם אזור גוש דן מתאים לבקשה ברמת גן");
check(!proMatches({ ...base, city_name: "בני ברק", region: null }, reqRG), "בלי אזור — בני ברק לא מתאימה לרמת גן");
check(proMatches({ ...base, city_name: "ירושלים", extra_cities: ["רמת גן"] }, reqRG), "עיר נוספת שנבחרה מתאימה");
check(!proMatches({ ...base, city_name: "ירושלים", region: "jerusalem" }, reqRG), "אזור ירושלים לא מכסה את רמת גן");
check(proMatches({ ...base, city_name: "תל אביב יפו", region: "gush_dan" }, { ...reqRG, city_name: "קריית אונו" }), "שמות עם קרית/קריית ומקף מזוהים כאותה עיר");

r = await post("/pros/new", [
  ["phone", "0541212121"], ["role", "organist"], ["name", "גוש דן טוב"], ["city_name", "בני ברק"], ["region", "gush_dan"],
  ["extra_cities", "פתח תקווה, תל אביב - יפו"], ["style", "both"], ["days", "1"], ["days", "2"], ["hs0", "10:00"], ["he0", "23:00"],
  ["has_pa", "1"], ["active", "1"], ["min_price", "500"], ["rating", "4"],
]);
const gd = (await mem.list("professionals")).find((x: any) => x.phone === "0541212121")!;
check(!!gd && gd.region === "gush_dan" && gd.extra_cities.length === 2 && gd.rating === 4, "אזור, ערים נוספות ודירוג נשמרו מהטופס");
const rq2 = await ppost("/request", [
  ["client_name", "יוסי"], ["client_phone", "0531313131"], ["need", "organist"], ["city_name", "רמת גן"], ["style", "hasidic"],
  ["event_date", "2031-03-02"], ["start_time", "20:00"], ["end_time", "22:00"], ["has_pa", "1"], ["max_organist", "1000"], ["ts", old],
], "7.7.7.7");
const gdOffers = (await mem.list("offers")).filter((o: any) => o.pro_id === gd.id);
check(rq2.status === 302 && gdOffers.length === 1 && gdOffers[0].auto, "בקשה ברמת גן קיבלה הצעה אוטומטית מבעל מקצוע מבני ברק (גוש דן)");

globalThis.fetch = realFetch;
console.log(fails ? `${fails} נכשלו` : "אתר הניהול תקין");
process.exit(fails ? 1 : 0);
