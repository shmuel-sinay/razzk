import type { Env } from "./types";
import type { Settings } from "./settings";

/** שליחת צינתוק דרך ה-API של ימות המשיח. בלי טוקן — לא נשלח כלום. */
export async function sendTzintuk(env: Env, s: Settings, phones: string[]): Promise<boolean> {
  if (!env.YEMOT_TOKEN || !phones.length) return false;
  const p = new URLSearchParams({
    token: env.YEMOT_TOKEN,
    phones: phones.join(","),
    TzintukTimeOut: "9",
  });
  if (s.tzintuk_caller_id) p.set("callerId", s.tzintuk_caller_id);
  try {
    const res = await fetch(`https://www.call2all.co.il/ym/api/RunTzintuk?${p}`);
    return res.ok;
  } catch {
    return false;
  }
}
