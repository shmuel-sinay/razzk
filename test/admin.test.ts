// בדיקת אתר הניהול מקצה לקצה: הזדהות, טפסים, התאמה ושליחת הצעה.
// מחליף את fetch בשרת PostgREST מדומה מעל מסד בזיכרון.
import { admin } from "../src/admin";
import { MemDb } from "./memdb";
import { normalize } from "../src/hebrew";

const mem = new MemDb();
await mem.insert("cities", { name: "ירושלים", normalized: normalize("ירושלים") });
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

console.log("הצעה ואישור");
await post(`/requests/${req.id}/offer`, [["pro_id", pro.id], ["amount", "900"]]);
const offer = (await mem.list("offers"))[0];
check(offer?.amount === 900 && offer?.source === "web", "הצעה נוצרה מהאתר");
await post(`/offers/${offer.id}/accept`, []);
const acc = (await mem.list("offers"))[0];
check(acc.status === "accepted" && acc.fee_client === 90, "הצעה אושרה והעמלה חושבה");
check((await (await get(`/requests/${req.id}`)).text()).includes("0501111111"), "פרטי הקשר מוצגים אחרי אישור");

console.log("בקשה בעיר אחרת לא מותאמת");
await post("/requests/new", [["client_name", "דני"], ["client_phone", "0533333333"], ["need", "organist"], ["city_name", "בני ברק"], ["style", "hasidic"], ["event_date", "2030-01-01"], ["start_time", "20:00"], ["end_time", "23:00"], ["has_pa", "1"], ["max_organist", "1000"]]);
const req2 = (await mem.list("requests"))[1];
check((await (await get(`/requests/${req2.id}`)).text()).includes("בעלי מקצוע מתאימים (0)"), "אין התאמה לעיר אחרת");
check((await (await get(`/requests/${req2.id}`)).text()).includes("לא נמצאה במאגר"), "אזהרה על עיר שלא במאגר");

console.log("עריכת בעל מקצוע");
r = await post(`/pros/${pro.id}`, [["phone", "0501111111"], ["role", "organist"], ["name", "דוד לוי"], ["city_name", "ירושלים"], ["style", "both"], ["min_price", "700"], ["active", "1"]]);
check((await mem.list("professionals"))[0].name === "דוד לוי" && (await mem.list("professionals"))[0].min_price === 700, "העריכה נשמרה");

globalThis.fetch = realFetch;
console.log(fails ? `${fails} נכשלו` : "אתר הניהול תקין");
process.exit(fails ? 1 : 0);
