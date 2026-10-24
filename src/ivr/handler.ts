import type { Db, Env } from "../types";
import type { Settings } from "../settings";
import { type Ctx, type Sess } from "./core";
import { route, startFlow } from "./flows";

/**
 * טיפול בבקשה אחת מימות המשיח. המצב נשמר במסד לפי מזהה השיחה והשלוחה.
 *
 * הזרימה: שלוחת api בימות אוספת את התשובות (api_NNN) ושולחת אותן יחד עם הפרמטר flow.
 * השרת בודק אותן, שואל רק את מה שחסר או דורש אישור (עיר, ימים, הקלטות, שעות נוספות...),
 * ובסיום חוזר לתפריט הראשי שבקו (go_to_folder=/).
 */
export async function handleIvr(base: { db: Db; env: Env; settings: Settings }, p: Record<string, string>): Promise<string> {
  const callId = p.ApiCallId || "";
  const phone = (p.ApiPhone || "").replace(/\D/g, "");
  if (!callId) return "id_list_message=t-שגיאה&go_to_folder=hangup";
  const key = `${callId}:${p.ApiExtension || ""}`;

  // ניתוק שיחה (api_hangup_send) — ניקוי המצב בלבד
  if (p.hangup === "yes") {
    await base.db.remove("sessions", { call_id: key });
    return "noop=ok";
  }

  const ctx: Ctx = { ...base, phone };
  const row = await base.db.get("sessions", { call_id: key });
  let s: Sess = row ? row.data : { callId: key, seq: 0, node: "done", data: {}, pre: [] };

  let out: string;
  try {
    if (s.expect && s.node !== "done") {
      // שיחה פעילה בשרת: ממשיכים מהתשובה האחרונה (גם אם ריקה)
      out = await route(ctx, s, p[s.expect]);
    } else {
      // התחלה חדשה של שלוחה
      s = { callId: key, seq: 0, node: "start", data: {}, pre: [] };
      out = await startFlow(ctx, s, p);
    }
  } catch (e) {
    console.error("ivr error", e);
    out = "id_list_message=t-אירעה שגיאה. נסו שוב מאוחר יותר&go_to_folder=/";
    s.expect = undefined; s.node = "done";
  }
  await base.db.upsert("sessions", { call_id: key, data: s, updated_at: new Date().toISOString() }, "call_id");
  return out;
}
