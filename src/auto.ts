import type { Db, Env, Row } from "./types";
import type { Settings } from "./settings";
import { proMatches, budgetFor, sameCity } from "./match";
import { normalize } from "./hebrew";
import { sendTzintuk } from "./yemot";

const clamp = (x: number) => Math.max(0, Math.min(1, x));

/** ציון התאמה 0-100: איכות (דירוג), מחיר יחסית לתקציב, וקרבה (אותה שכונה) — המשקלים בהגדרות */
export function scorePro(pro: Row, req: Row, s: Settings): number {
  const wq = Number(s.weight_quality ?? 50), wp = Number(s.weight_price ?? 30), wa = Number(s.weight_area ?? 20);
  const quality = clamp((Number(pro.rating ?? 3)) / 5);
  const budget = budgetFor(pro.role, req, Number(s.over_budget_percent || 15));
  const price = budget > 0 ? clamp(1 - Number(pro.min_price || 0) / budget) : 0;
  // קרבה: אותה עיר (ושכונה זהה = מקסימום); עיר סמוכה באזור השירות מקבלת ציון נמוך יותר
  const hood = !sameCity(pro, req)
    ? 0.2
    : pro.neighborhood && req.neighborhood
    ? normalize(pro.neighborhood) === normalize(req.neighborhood) ? 1 : 0.3
    : 0.5;
  const total = wq + wp + wa || 1;
  return Math.round(((wq * quality + wp * price + wa * hood) / total) * 1000) / 10;
}

/**
 * יוצר הצעות אוטומטיות לבקשה: בעלי המקצוע המתאימים מדורגים לפי הציון, והטובים ביותר
 * (עד auto_offer_count בסך הכול) מקבלים הצעה במחיר המינימלי שלהם. בטוח להרצה חוזרת.
 */
export async function autoOffer(db: Db, env: Env, s: Settings, req: Row): Promise<{ matched: number; created: number }> {
  const over = Number(s.over_budget_percent || 15);
  const pros = (await db.list("professionals", { match: { active: true }, limit: 10000 })).filter((p) => proMatches(p, req, over));
  if (s.auto_offer_enabled !== "true") return { matched: pros.length, created: 0 };

  const have = await db.list("offers", { match: { request_id: req.id } });
  const already = new Set(have.map((o) => o.pro_id));
  const room = Math.max(0, Number(s.auto_offer_count || 3) - have.length);
  const pick = pros
    .filter((p) => !already.has(p.id))
    .map((p) => ({ p, score: scorePro(p, req, s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, room);

  for (const { p, score } of pick) {
    const budget = budgetFor(p.role, req, over);
    await db.insert("offers", {
      request_id: req.id, pro_id: p.id, amount: p.min_price || budget, status: "sent", auto: true, score, source: "auto",
    });
  }
  if (pick.length) {
    await sendTzintuk(env, s, pick.filter((x) => x.p.tzintuk_ok).map((x) => x.p.phone));
    if (req.tzintuk_ok) await sendTzintuk(env, s, req.contact_phones || [req.client_phone]);
  }
  return { matched: pros.length, created: pick.length };
}

/** בעל מקצוע חדש/מעודכן: משלימים הצעות לבקשות פתוחות שעדיין לא מלאות */
export async function fillOpenRequests(db: Db, env: Env, s: Settings): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const open = (await db.list("requests", { match: { status: "open" }, limit: 2000 })).filter((r) => r.event_date >= today);
  for (const r of open) await autoOffer(db, env, s, r);
}
