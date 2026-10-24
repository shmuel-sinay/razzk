// בדיקת עשן לאתר הניהול: הזדהות ומסלולים מול מסד מדומה (fetch מדומה ל-Supabase)
import { admin } from "../src/admin";

const store: Record<string, any[]> = {
  professionals: [{ id: "p1", name: "דוד", phone: "050", role: "organist", city_name: "ירושלים", active: true, contact_phones: ["050"], days: [1], hours: [] }],
  requests: [{ id: "r1", client_name: "משה", city_name: "ירושלים", event_date: "2030-01-01", status: "open" }],
  offers: [{ id: "o1", request_id: "r1", pro_id: "p1", amount: 900, status: "sent" }],
  clients: [], admin_messages: [], partners: [], settings: [], cities: [],
};
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any = {}) => {
  const u = new URL(String(url));
  const t = u.pathname.split("/").pop()!;
  if (init.method === "PATCH" || init.method === "DELETE" || init.method === "POST") return new Response("[]");
  return new Response(JSON.stringify(store[t] ?? []));
}) as any;

const env: any = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "k", ADMIN_PASSWORD: "pw" };
const auth = { Authorization: "Basic " + btoa("admin:pw") };
let fails = 0;
const check = (ok: boolean, m: string) => { console.log((ok ? "  ✓ " : "  ✗ ") + m); if (!ok) fails++; };

const noAuth = await admin.request("/", {}, env);
check(noAuth.status === 401, "בלי סיסמה נחסם");
const bad = await admin.request("/", { headers: { Authorization: "Basic " + btoa("a:wrong") } }, env);
check(bad.status === 401, "סיסמה שגויה נחסמת");
for (const path of ["/", "/settings", "/pros", "/pros/p1", "/clients", "/requests", "/offers", "/messages", "/partners", "/cities"]) {
  const r = await admin.request(path, { headers: auth }, env);
  const html = await r.text();
  check(r.status === 200 && html.includes("<html"), `דף ${path} נטען`);
  if (path === "/offers") check(html.includes("דוד") && html.includes("משה"), "הצעות מציגות שמות");
}
globalThis.fetch = realFetch;
console.log(fails ? `${fails} נכשלו` : "אתר הניהול תקין");
process.exit(fails ? 1 : 0);
