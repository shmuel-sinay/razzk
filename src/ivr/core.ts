import type { Db, Env, Row } from "../types";
import type { Settings } from "../settings";

export interface Ctx {
  db: Db;
  env: Env;
  settings: Settings;
  phone: string;
}

export interface Sess {
  callId: string;
  seq: number;
  expect?: string;
  node: string;
  data: Row;
  pre: string[];
}

export type Part = string; // "t-טקסט" או "f-/נתיב/קובץ"

/** טקסט להקראה: בלי תווים שמפרקים את התחביר של ימות המשיח */
export const t = (text: string): Part =>
  "t-" + text.replace(/[=&,]/g, " ").replace(/\./g, " ").replace(/\s+/g, " ").trim();
export const f = (path: string): Part => "f-" + path;

/** הקדמה שתושמע לפני השאלה הבאה (לדוגמה: "הפרטים נשמרו") */
export function say(s: Sess, ...parts: Part[]) {
  s.pre.push(...parts);
}

function readCmd(s: Sess, parts: Part[], spec: (name: string) => string): string {
  s.seq += 1;
  const name = `a${s.seq}`;
  s.expect = name;
  const all = [...s.pre, ...parts];
  s.pre = [];
  return `read=${all.join(".")}=${spec(name)}`;
}

export interface DigitsOpts { min?: number; max?: number; wait?: number; blockStar?: boolean; allowed?: string }

/** שאלה עם הקשת ספרות. אין אישור מובנה של ימות — האישור נעשה בשרת. */
export function readDigits(s: Sess, parts: Part[], o: DigitsOpts = {}): string {
  const { min = 1, max = 10, wait = 7, blockStar = false, allowed = "" } = o;
  return readCmd(s, parts, (n) => `${n},no,${max},${min},${wait},NO,${blockStar ? "yes" : "no"},no,,${allowed},,,,,no`);
}

/** הקלדת טקסט עברי במקלדת הרגילה של ימות */
export function readKeyboard(s: Sess, parts: Part[], max = 40): string {
  return readCmd(s, parts, (n) => `${n},no,${max},1,20,HebrewKeyboard,no,no,,,,,,,no`);
}

/** זיהוי דיבור (תמלול) */
export function readVoice(s: Sess, parts: Part[]): string {
  return readCmd(s, parts, (n) => `${n},no,voice,he-IL,no`);
}

/** הקלטה. הקובץ נשמר בנתיב folder/file; תפריט האישור/הקלטה מחדש הוא של ימות. */
export function readRecord(s: Sess, parts: Part[], folder: string, file: string, maxSec = 30): string {
  return readCmd(s, parts, (n) => `${n},no,record,${folder},${file},,,,1,${maxSec}`);
}

export function hangup(s: Sess, ...parts: Part[]): string {
  const all = [...s.pre, ...parts];
  s.pre = [];
  s.expect = undefined;
  return (all.length ? `id_list_message=${all.join(".")}&` : "") + "go_to_folder=hangup";
}

export const isEmpty = (raw: string | undefined | null) =>
  raw === undefined || raw === null || raw.trim() === "" || raw === "None";
