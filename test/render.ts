// מייצר קובצי HTML של עמודי האתר מנתוני דמו, לבדיקה חזותית (לא חלק מהבדיקות האוטומטיות)
import { admin } from "../src/admin";
import { pub } from "../src/public";
import { MemDb } from "./memdb";
import { normalize } from "../src/hebrew";
import { writeFileSync } from "node:fs";

const out = process.argv[2];
const mem = new MemDb();
for (const n of ["ירושלים", "בני ברק", "רמת גן", "פתח תקווה", "תל אביב - יפו", "בית שמש", "אשדוד"]) await mem.insert("cities", { name: n, normalized: normalize(n) });
const base = { active: true, tzintuk_ok: true, has_pa: true, days: [1, 2, 3, 4, 5, 6], hours: [{ start: "1800", end: "2300" }, { start: "2300", end: "0100" }], style: "hasidic" };
const p1 = await mem.insert("professionals", { ...base, phone: "0534162923", name: "שימי רזזק", role: "organist_singer", city_name: "ירושלים", neighborhood: "רמות א׳", region: "jerusalem", min_price: 1200, rating: 5, public_token: "tok1", bio: "אורגניסט וזמר עם 15 שנות ניסיון בחתונות ובאירועים", contact_phones: ["0534162923"] });
const p2 = await mem.insert("professionals", { ...base, phone: "0501112222", name: "דוד כהן", role: "organist", city_name: "ירושלים", region: "gush_dan", min_price: 800, rating: 4, style: "both", public_token: "tok2", days: [1, 3, 5], hours: [{ start: "1000", end: "2200" }] });
await mem.insert("professionals", { ...base, phone: "0503334444", name: "יעקב לוי", role: "singer", city_name: "בני ברק", min_price: 600, rating: 3, active: false, public_token: "tok3" });
const rq = await mem.insert("requests", { client_name: "משה לוי", client_phone: "0522222222", need: "organist", city_name: "ירושלים", neighborhood: "רמות א׳", hall_name: "אולם הנרות", style: "hasidic", event_date: "2031-03-02", start_time: "2000", end_time: "2300", has_pa: true, max_organist: 1500, status: "open", public_token: "rtok", contact_phones: ["0522222222"], created_at: new Date().toISOString() });
await mem.insert("offers", { request_id: rq.id, pro_id: p1.id, amount: 1200, status: "sent", auto: true, score: 87.5 });
await mem.insert("offers", { request_id: rq.id, pro_id: p2.id, amount: 800, status: "accepted", auto: true, score: 71, fee_client: 80, fee_pro: 0 });
await mem.insert("clients", { phone: "0522222222", name: "משה לוי" });
for (const [c, n] of [["ירושלים", "רמות א׳"], ["ירושלים", "גאולה"], ["ירושלים", "בית וגן"], ["בני ברק", "פרדס כץ"]]) await mem.insert("neighborhoods", { city: c, name: n });

globalThis.fetch = (async (url: any, init: any = {}) => {
  const u = new URL(String(url)); const table = u.pathname.split("/").pop()!; const method = init.method || "GET";
  const match: Record<string, string> = {}; for (const [k, v] of u.searchParams) if (v.startsWith("eq.")) match[k] = v.slice(3);
  if (method === "GET") { const rows = await mem.list(table, { match, order: u.searchParams.get("order") || undefined }); return new Response(JSON.stringify(rows)); }
  return new Response("[]");
}) as any;
const env: any = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "k", ADMIN_PASSWORD: "pw" };
const auth = { Authorization: "Basic " + btoa("a:pw") };
const save = async (name: string, res: Response) => writeFileSync(`${out}/${name}.html`, await res.text());
for (const [n, p] of [["dash", "/"], ["pros", "/pros"], ["prosnew", "/pros/new"], ["match", `/requests/${rq.id}`], ["reqnew", "/requests/new"], ["settings", "/settings"], ["hoods", "/neighborhoods"]]) await save("admin_" + n, await admin.request(p, { headers: auth }, env));
for (const [n, p] of [["home", "/"], ["join", "/join"], ["request", "/request"], ["offers", "/r/rtok"], ["pro", "/p/tok1"]]) await save("pub_" + n, await pub.request(p, {}, env));
