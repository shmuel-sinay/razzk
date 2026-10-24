// סימולציה של שיחות ימות המשיח מול השרת (בלי רשת): הרשמת בעל מקצוע, בקשת לקוח, התאמה והצעה
import { MemDb } from "./memdb";
import { handleIvr } from "../src/ivr/handler";
import { loadSettings } from "../src/settings";
import { normalize } from "../src/hebrew";
import type { Env } from "../src/types";

const db = new MemDb();
for (const name of ["ירושלים", "בני ברק", "בית שמש", "אלעד"]) await db.insert("cities", { name, normalized: normalize(name) });
const env = { IVR_SECRET: "x" } as Env;
let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.log("  ✗ " + msg); } else console.log("  ✓ " + msg); };

class Call {
  last = ""; params: Record<string, string> = {}; id = Math.random().toString(36).slice(2);
  constructor(public phone: string) {}
  async send(answer?: string) {
    const p: Record<string, string> = { ApiCallId: this.id, ApiPhone: this.phone, ...this.params };
    if (answer !== undefined) { const m = this.last.match(/=(a\d+),/); if (m) p[m[1]] = answer; this.params = { ...p }; delete this.params.ApiCallId; delete this.params.ApiPhone; }
    this.last = await handleIvr({ db, env, settings: await loadSettings(db) }, p);
    return this.last;
  }
  async seq(...answers: string[]) { for (const a of answers) { await this.send(a); if (/go_to_folder=hangup/.test(this.last) && !this.last.startsWith("read=")) break; } return this.last; }
}

console.log("בעל מקצוע נרשם");
const pro = new Call("0501111111");
await pro.send();
await pro.seq(
  "2", "1", "1",                 // רישום, אישור תנאים, אורגניסט בלבד
  "דוד כהן", "1",                // שם + אישור
  "30", "1",                     // גיל + אישור
  "ירושלים", "1",                // עיר + אישור
  "x",                           // הקלטת שכונה
  "1", "1",                      // סגנון חסידי + אישור
  "123456", "1",                 // ימים: ראשון..שישי? (1-6)
  "x",                           // הקלטת פרטים
  "1800", "2300", "1",           // שעות 18:00-23:00, ואישור בתפריט
  "1",                           // הגברה: כן
  "800", "1",                    // מינימום 800
  "0501111111", "1",             // טלפון + אישור
  "1",                           // מייל: כן
  "1",                           // צינתוקים
  "1",                           // התחייבות
);
check(db.t.professionals?.length === 1, "בעל המקצוע נשמר");
const p0 = db.t.professionals?.[0] || {};
check(p0.city_name === "ירושלים" && p0.min_price === 800 && p0.days?.length === 6, `פרטים נשמרו (${p0.city_name}, ${p0.min_price}, ${JSON.stringify(p0.hours)})`);

console.log("לקוח מבקש אורגניסט");
const cl = new Call("0522222222");
await cl.send();
await cl.seq(
  "1", "1", "1",                 // לקוח, תנאים, אורגניסט בלבד
  "משה לוי", "1",
  "ירושלים", "1",
  "x", "x",                      // שכונה, רחוב
  "12", "1",                     // בניין
  "אולם הנרות", "1",             // שם אולם
  "1", "1",                      // סגנון חסידי
  "010120", "010130", "1",       // תאריך בעבר נדחה; 1.1.2030 (יום שלישי) מאושר
  "2000", "1", "2300", "1",      // שעות האירוע
  "1",                           // יש הגברה באולם
  "1000", "1",                   // תקציב לאורגניסט
  "2",                           // בלי חריגה
  "0522222222", "1",             // טלפון
  "2",                           // בלי צינתוקים
  "1",                           // התחייבות
);
check(db.t.requests?.length === 1, "הבקשה נשמרה");
check(/נמצאו 1 בעלי מקצוע/.test(cl.last), "נמצא בעל מקצוע מתאים אחד");

console.log("בעל המקצוע רואה את הבקשה ומגיש הצעה");
const pro2 = new Call("0501111111");
await pro2.send();
await pro2.seq("3", "1");
check(/בקשה 1 מתוך 1/.test(pro2.last), "הבקשה מופיעה בבקשות המתאימות");
await pro2.seq("1", "900", "");
const offers = db.t.offers || [];
check(offers.length === 1 && offers[0].amount === 900, "ההצעה נשמרה");

console.log("הלקוח שומע את ההצעה ומאשר");
const cl2 = new Call("0522222222");
await cl2.send();
await cl2.seq("3", "1");
check(/הצעה 1 מתוך 1/.test(cl2.last) && /900 שקלים/.test(cl2.last), "ההצעה נשמעת ללקוח");
await cl2.seq("2", "1");
check((db.t.offers || [])[0].status === "accepted", "ההצעה אושרה");
check(/050/.test(cl2.last.replace(/ /g, "")) || /אושרה/.test(cl2.last), "פרטי הקשר נמסרו");
check((db.t.offers || [])[0].fee_client === 90, "עמלה חושבה (10% על הלקוח = 90)");

console.log("בקשה לא מתאימה (עיר אחרת) לא מתאימה");
const cl3 = new Call("0533333333");
await cl3.send();
await cl3.seq("1","1","1","דני","1","בני ברק","1","x","x","5","1","אולם","1","1","1","010130","1","2000","1","2300","1","1","1","1000","1","2","0533333333","1","2","1");
check((db.t.requests || []).length === 2, "בקשה שנייה נשמרה");
check(/כרגע לא נמצאו/.test(cl3.last), "אין התאמה לעיר אחרת");

console.log(fails ? `\n${fails} בדיקות נכשלו` : "\nכל הבדיקות עברו");
process.exit(fails ? 1 : 0);
