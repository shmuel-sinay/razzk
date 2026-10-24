import type { Db, Env } from "../types";
import type { Settings } from "../settings";
import { type Ctx, type Sess } from "./core";
import { route } from "./flows";

/** טיפול בבקשה אחת מימות המשיח. המצב נשמר במסד לפי מזהה השיחה. */
export async function handleIvr(base: { db: Db; env: Env; settings: Settings }, p: Record<string, string>): Promise<string> {
  const callId = p.ApiCallId || "";
  const phone = (p.ApiPhone || "").replace(/\D/g, "");
  if (!callId) return "id_list_message=t-שגיאה&go_to_folder=hangup";

  // ניתוק שיחה (api_hangup_send) — ניקוי המצב בלבד
  if (p.hangup === "yes") {
    await base.db.remove("sessions", { call_id: callId });
    return "noop=ok";
  }

  const ctx: Ctx = { ...base, phone };
  const row = await base.db.get("sessions", { call_id: callId });
  const s: Sess = row ? row.data : { callId, seq: 0, node: "start", data: {}, pre: [] };
  const raw = s.expect ? p[s.expect] : undefined;

  let out: string;
  try {
    out = await route(ctx, s, raw);
  } catch (e) {
    console.error("ivr error", e);
    out = "id_list_message=t-אירעה שגיאה. נסו שוב מאוחר יותר&go_to_folder=hangup";
  }
  await base.db.upsert("sessions", { call_id: callId, data: s, updated_at: new Date().toISOString() }, "call_id");
  return out;
}
