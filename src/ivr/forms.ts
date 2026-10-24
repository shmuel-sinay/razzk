import type { Row } from "../types";
import { normalize, bestMatch, DAY_NAMES, fmtDate, fmtTime } from "../hebrew";
import {
  type Ctx, type Sess, type Part, t, f as fp, say, readDigits, readKeyboard, readVoice, readRecord, isEmpty,
} from "./core";

/** הגדרת שדה בטופס טלפוני */
export interface Field {
  key: string;
  kind: "number" | "choice" | "yesno" | "text" | "city" | "record" | "date" | "time" | "days" | "hours" | "phones" | "info";
  prompt?: string;
  min?: number;
  max?: number;
  confirm?: boolean;
  choices?: { d: string; label: string; value: any }[];
  fmt?: (v: any) => string; // הקראה לאישור
  validate?: (v: number) => boolean;
  recPrefix?: string;
  recSec?: number;
  skip?: (vals: Row) => boolean;
  voiceTries?: number;
}

export interface FormDef {
  fields: Field[];
  /** מסתיים: מחזיר את התגובה הבאה לימות */
  onDone: (ctx: Ctx, s: Sess, vals: Row) => Promise<string>;
  /** ביטול (לדוגמה אחרי יותר מדי כשלונות) */
  onAbort: (ctx: Ctx, s: Sess) => Promise<string>;
}

type Res = { out: string } | { done: any } | { abort: true };

const MAX_FAILS = 6;

const YES = ["כן", "1"];
void YES;

export async function cities(ctx: Ctx): Promise<{ id: number | null; name: string }[]> {
  const rows = await ctx.db.list("cities", { limit: 5000 });
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(r.name) && seen.add(r.name)).map((r) => ({ id: r.id, name: r.name }));
}

function confirmOut(s: Sess, readback: string): string {
  return readDigits(s, [t(readback), t("לאישור הקישו 1. לתיקון הקישו 2.")], { min: 1, max: 1, allowed: "12" });
}

const recFile = (ctx: Ctx, prefix: string) => `${prefix}_${ctx.phone}_${Date.now().toString(36)}`;

/** בקשת הערך מהמשתמש לפי סוג השדה */
function askField(ctx: Ctx, s: Sess, fld: Field): string | null {
  const d = s.data;
  const p = fld.prompt ? [t(fld.prompt)] : [];
  switch (fld.kind) {
    case "info":
      say(s, ...p);
      return null;
    case "number":
      return readDigits(s, p, { min: fld.min ?? 1, max: fld.max ?? 10 });
    case "choice":
    case "yesno":
      return readDigits(s, p, { min: 1, max: 1, allowed: (fld.choices || yesNo).map((c) => c.d).join("") });
    case "date":
      return readDigits(s, p, { min: 6, max: 6, wait: 10 });
    case "time":
      return readDigits(s, p, { min: 4, max: 4, wait: 10 });
    case "days":
      return readDigits(s, p, { min: 1, max: 7, wait: 10 });
    case "record": {
      d.recFile = recFile(ctx, fld.recPrefix || fld.key);
      return readRecord(s, p, ctx.settings.recordings_folder, d.recFile, fld.recSec ?? 30);
    }
    case "text":
    case "city": {
      const voiceTries = fld.voiceTries ?? 0; // זיהוי דיבור עולה יחידות בימות — כברירת מחדל מקלידים
      return d.tries < voiceTries ? readVoice(s, p) : readKeyboard(s, [t((fld.prompt || "").replace(/^אנא אמרו/, "אנא הקלידו") + " ובסיום הקישו סולמית.")]);
    }
    case "hours":
      return d.sub === "end"
        ? readDigits(s, [t("הקישו שעת סיום הזמינות בארבע ספרות, למשל אחת בלילה היא אפס אחת אפס אפס.")], { min: 4, max: 4, wait: 10 })
        : d.sub === "menu"
        ? readDigits(s, [t(`הזמינות שנקלטה היא ${hoursReadback(d.tmp)}. לאישור הקישו 1. לתיקון הקישו 2. להוספת שעות נוספות הקישו 3.`)], { min: 1, max: 1, allowed: "123" })
        : readDigits(s, [t((d.tmp?.length ? "הקישו שעת התחלה נוספת" : fld.prompt || "הקישו שעת התחלת הזמינות") + " בארבע ספרות, לדוגמה, שמונה בערב היא שתיים אפס אפס אפס.")], { min: 4, max: 4, wait: 10 });
    case "phones":
      return d.sub === "menu"
        ? readDigits(s, [t(`המספרים שנקלטו הם ${d.tmp.map(spell).join(" , ")}. לאישור הקישו 1. לתיקון הקישו 2. להוספת מספר נוסף הקישו 3.`)], { min: 1, max: 1, allowed: "123" })
        : readDigits(s, [t((d.tmp?.length ? "הקישו מספר טלפון נוסף" : fld.prompt || "הקישו מספר טלפון") + " ובסיומו סולמית.")], { min: 9, max: 10, wait: 12 });
  }
}

const yesNo = [
  { d: "1", label: "כן", value: true },
  { d: "2", label: "לא", value: false },
];

const spell = (n: string) => n.split("").join(" ");
const hoursReadback = (h: Row[]) => h.map((x) => `מ-${fmtTime(x.start)} עד ${fmtTime(x.end)}`).join(" , ");

const validTime = (v: string) => /^\d{4}$/.test(v) && +v.slice(0, 2) < 24 && +v.slice(2) < 60;
const validPhone = (v: string) => /^0\d{8,9}$/.test(v);

/** פירוק התשובה. מחזיר ערך מועמד + הקראה לאישור, או null אם לא תקין */
async function parse(ctx: Ctx, s: Sess, fld: Field, raw: string): Promise<{ cand: any; readback: string } | null> {
  const d = s.data;
  const v = raw.trim();
  switch (fld.kind) {
    case "number": {
      if (!/^\d+$/.test(v)) return null;
      const n = Number(v);
      if (fld.validate && !fld.validate(n)) return null;
      return { cand: n, readback: fld.fmt ? fld.fmt(n) : String(n) };
    }
    case "choice":
    case "yesno": {
      const c = (fld.choices || yesNo).find((x) => x.d === v);
      return c ? { cand: c.value, readback: c.label } : null;
    }
    case "date": {
      if (!/^\d{6}$/.test(v)) return null;
      const dd = +v.slice(0, 2), mm = +v.slice(2, 4), yy = 2000 + +v.slice(4);
      const dt = new Date(Date.UTC(yy, mm - 1, dd));
      if (dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
      const iso = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      if (iso < new Date().toISOString().slice(0, 10)) return null;
      return { cand: iso, readback: fmtDate(iso) };
    }
    case "time":
      return validTime(v) ? { cand: v, readback: fmtTime(v) } : null;
    case "days": {
      const all = v.includes("8");
      const set = all ? [1, 2, 3, 4, 5, 6, 7] : [...new Set(v.split("").map(Number))].filter((n) => n >= 1 && n <= 7).sort();
      if (!set.length) return null;
      return { cand: set, readback: all ? "כל הימים" : set.map((n) => DAY_NAMES[n]).join(" , ") };
    }
    case "text": {
      if (v.length < 2) return null;
      return { cand: v, readback: v };
    }
    case "city": {
      const list = await cities(ctx);
      const m = bestMatch(v, list);
      if (m) return { cand: { id: m.id, name: m.name }, readback: m.name };
      if (d.tries >= (fld.voiceTries ?? 0)) {
        // אחרי הקלדה ידנית שלא נמצאה במאגר — נשמור כפי שהוקלד; המנהל יוכל לתקן
        const exact = list.find((c) => normalize(c.name) === normalize(v));
        return { cand: { id: exact?.id ?? null, name: v }, readback: v };
      }
      return null;
    }
  }
  return null;
}

/** המשך הטופס לפי הקלט האחרון. מחזיר את התגובה לימות. */
export async function runForm(ctx: Ctx, s: Sess, form: FormDef, raw: string | null): Promise<string> {
  const d = s.data;
  for (;;) {
    const fld = form.fields[d.i];
    if (!fld) return form.onDone(ctx, s, d.vals);
    if (fld.skip?.(d.vals)) { d.i++; d.phase = undefined; continue; }

    if (!d.phase) {
      d.phase = "ask"; d.tries = d.tries ?? 0; d.sub = undefined; d.tmp = fld.kind === "hours" || fld.kind === "phones" ? [] : undefined;
      d.tries = 0;
      if (d.pre && d.pre[fld.key] !== undefined) {
        // ערך שכבר נאסף בימות המשיח (api_NNN): בודקים אותו בשרת במקום לשאול שוב
        const pv = d.pre[fld.key];
        delete d.pre[fld.key];
        const r = await prefill(ctx, s, fld, pv);
        if (r && "done" in r) { d.vals[fld.key] = r.done; d.i++; d.phase = undefined; continue; }
        if (r && "out" in r) return r.out;
      }
      const out = askField(ctx, s, fld);
      if (out === null) { d.vals[fld.key] = undefined; d.i++; d.phase = undefined; continue; }
      return out;
    }

    const r = await handle(ctx, s, fld, raw);
    raw = null;
    if ("abort" in r) return form.onAbort(ctx, s);
    if ("out" in r) return r.out;
    d.vals[fld.key] = r.done;
    d.i++; d.phase = undefined; d.tries = 0;
  }
}

/** ערך שהגיע מוכן מימות: אימות, ואם צריך — אישור מול המשתמש */
async function prefill(ctx: Ctx, s: Sess, fld: Field, pv: any): Promise<Res | null> {
  const d = s.data;
  if (fld.kind === "hours") {
    if (!pv || !validTime(pv.start) || !validTime(pv.end)) return null;
    d.tmp = [pv]; d.sub = "menu";
    return { out: askField(ctx, s, fld)! };
  }
  if (fld.kind === "phones") {
    if (typeof pv !== "string" || !validPhone(pv)) return null;
    d.tmp = [pv]; d.sub = "menu";
    return { out: askField(ctx, s, fld)! };
  }
  if (typeof pv !== "string" || isEmpty(pv)) return null;
  const p = await parse(ctx, s, fld, pv);
  if (!p) return null;
  const needConfirm = fld.confirm ?? ["city", "days"].includes(fld.kind); // שם ואולם כבר אושרו בימות
  if (!needConfirm) return { done: p.cand };
  d.cand = p.cand; d.readback = p.readback; d.phase = "confirm";
  return { out: confirmOut(s, p.readback) };
}

async function handle(ctx: Ctx, s: Sess, fld: Field, raw: string | null): Promise<Res> {
  const d = s.data;
  const reask = (): Res => {
    d.fails = (d.fails || 0) + 1;
    if (d.fails > MAX_FAILS) return { abort: true };
    d.phase = "ask";
    return { out: askField(ctx, s, fld)! };
  };
  const empty = isEmpty(raw);
  const v = (raw || "").trim();

  if (fld.kind === "record") {
    if (empty) { d.tries++; if (d.tries > 1) return { done: null }; return { out: askField(ctx, s, fld)! }; }
    return { done: `${ctx.settings.recordings_folder}/${d.recFile}` };
  }

  if (fld.kind === "hours") {
    if (d.sub === "menu") {
      if (v === "1") return { done: d.tmp };
      if (v === "2") { d.tmp = []; d.sub = undefined; return { out: askField(ctx, s, fld)! }; }
      if (v === "3") { d.sub = undefined; return { out: askField(ctx, s, fld)! }; }
      return { out: askField(ctx, s, fld)! };
    }
    if (d.sub === "end") {
      if (!validTime(v)) { say(s, t("הנתון לא תקין.")); d.sub = undefined; return reask(); }
      d.tmp.push({ start: d.start, end: v });
      d.sub = "menu";
      return { out: askField(ctx, s, fld)! };
    }
    if (!validTime(v)) { say(s, t("הנתון לא תקין.")); return reask(); }
    d.start = v; d.sub = "end";
    return { out: askField(ctx, s, fld)! };
  }

  if (fld.kind === "phones") {
    if (d.sub === "menu") {
      if (v === "1") return { done: d.tmp };
      if (v === "2") { d.tmp = []; d.sub = undefined; return { out: askField(ctx, s, fld)! }; }
      if (v === "3") { d.sub = undefined; return { out: askField(ctx, s, fld)! }; }
      return { out: askField(ctx, s, fld)! };
    }
    if (!validPhone(v)) { say(s, t("מספר הטלפון לא תקין.")); return reask(); }
    d.tmp.push(v); d.sub = "menu";
    return { out: askField(ctx, s, fld)! };
  }

  if (d.phase === "confirm") {
    if (v === "1") return { done: d.cand };
    if (v === "2") { d.tries++; return reask(); }
    return { out: confirmOut(s, d.readback) };
  }

  // phase === "ask"
  if (empty) { d.tries++; return reask(); }
  const p = await parse(ctx, s, fld, v);
  if (!p) { d.tries++; say(s, t("לא הצלחנו להבין.")); return reask(); }
  const needConfirm = fld.confirm ?? !["choice", "yesno", "info"].includes(fld.kind);
  if (!needConfirm) return { done: p.cand };
  d.cand = p.cand; d.readback = p.readback; d.phase = "confirm";
  return { out: confirmOut(s, p.readback) };
}

export type { Part };
export { fp };
