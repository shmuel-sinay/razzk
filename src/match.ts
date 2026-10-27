import type { Row } from "./types";
import { systemWeekday, normalize } from "./hebrew";
import { cityInRegion } from "./regions";

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2));

/** חלון זמינות "מ-21:00 עד 01:00" נחשב עד אחרי חצות */
function window(start: string, end: string): [number, number] {
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 24 * 60;
  return [s, e];
}

export function budgetFor(role: string, req: Row, overPct: number): number {
  const base =
    role === "organist" ? req.max_organist :
    role === "singer" ? req.max_singer :
    (req.max_organist || 0) + (req.max_singer || 0);
  const mult = req.allow_over ? 1 + overPct / 100 : 1;
  return Math.floor((base || 0) * mult);
}

export function sameCity(a: Row, b: Row): boolean {
  return (a.city_id && b.city_id && a.city_id === b.city_id) ||
    (!!a.city_name && normalize(a.city_name) === normalize(b.city_name || ""));
}

/** האם בעל המקצוע משרת את עיר הבקשה: עיר ראשית, ערים נוספות, או אחד מהערים באזור שבחר (למשל גוש דן) */
export function servesCity(pro: Row, req: Row): boolean {
  if (sameCity(pro, req)) return true;
  const want = normalize(req.city_name || "");
  if ((pro.extra_cities || []).some((c: string) => normalize(c) === want)) return true;
  return cityInRegion(pro.region, req.city_name);
}

/** האם בעל מקצוע מתאים לבקשה — לפי עיר, תפקיד, סגנון, יום, שעות, הגברה ותקציב */
export function proMatches(pro: Row, req: Row, overPct = 15): boolean {
  if (!pro.active) return false;
  if (!servesCity(pro, req)) return false;
  if (req.need === "organist" && pro.role === "singer") return false;
  if (req.style !== "both" && pro.style !== "both" && pro.style !== req.style) return false;
  if (!(pro.days || []).includes(systemWeekday(req.event_date))) return false;
  const [rs, re] = window(req.start_time, req.end_time);
  const ok = (pro.hours || []).some((h: Row) => {
    const [hs, he] = window(h.start, h.end);
    return rs >= hs && re <= he;
  });
  if (!ok) return false;
  if (!req.has_pa && !pro.has_pa) return false;
  return (pro.min_price || 0) <= budgetFor(pro.role, req, overPct);
}
