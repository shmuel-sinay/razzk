// סימולציה של שיחות ימות המשיח מול השרת (בלי רשת).
// שלוחת api בימות אוספת את התשובות ושולחת אותן יחד; השרת בודק ושואל רק מה שחסר.
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
  last = "";
  params: Record<string, string> = {};
  id = Math.random().toString(36).slice(2);
  constructor(public phone: string, public ext: string) {}
  private async post(extra: Record<string, string>) {
    this.params = { ...this.params, ...extra };
    const p = { ApiCallId: this.id, ApiPhone: this.phone, ApiExtension: this.ext, ...this.params };
    this.last = await handleIvr({ db, env, settings: await loadSettings(db) }, p);
    return this.last;
  }
  start(batch: Record<string, string>) { return this.post(batch); }
  async answers(...a: string[]) {
    for (const x of a) {
      const m = this.last.match(/=(a\d+),/);
      if (!m) break; // אין שאלה פתוחה (חזרה לשורש או ניתוק)
      await this.post({ [m[1]]: x });
    }
    return this.last;
  }
}
const toRoot = (c: Call) => /go_to_folder=\/$/.test(c.last);

console.log("בעל מקצוע נרשם (ימות אספה, השרת משלים)");
const pro = new Call("0501111111", "/2/1/1");
await pro.start({
  flow: "pro_register", role: "organist",
  NAME: "דוד כהן", AGE: "30", CITY: "ירושלים", STYLE: "1", DAYS: "123456",
  HSTART: "1800", HEND: "2300", PA: "1", MINPRICE: "800", PHONE: "0501111111", EMAILOK: "1", TZ: "1",
});
check(/ירושלים/.test(pro.last) && /אישור/.test(pro.last), "השרת מבקש לאשר את העיר שזוהתה");
await pro.answers("1", "x", "1", "1", "x", "1", "1", "1"); // עיר, הקלטת שכונה, סגנון, ימים, הקלטת פרטים, שעות, טלפונים, התחייבות
check(toRoot(pro), "חזרה לתפריט הראשי בקו");
const p0 = db.t.professionals?.[0] || {};
check(db.t.professionals?.length === 1, "בעל המקצוע נשמר");
check(p0.city_name === "ירושלים" && p0.min_price === 800 && p0.days?.length === 6 && p0.role === "organist",
  `פרטים נשמרו (${p0.city_name}, ${p0.min_price}, ${JSON.stringify(p0.hours)})`);

console.log("עיר שלא זוהתה — השרת שואל שוב עד הקלדה");
const odd = new Call("0504444444", "/2/1/1");
await odd.start({ flow: "pro_register", role: "singer", NAME: "אבי", AGE: "25", CITY: "זזזזזז", STYLE: "2", DAYS: "1", HSTART: "1000", HEND: "1400", PA: "2", MINPRICE: "500", PHONE: "0504444444", EMAILOK: "2", TZ: "2" });
check(/אישור/.test(odd.last) || /read=/.test(odd.last), "השרת ממשיך לשאול כשהעיר לא זוהתה");

console.log("לקוח מבקש אורגניסט");
const cl = new Call("0522222222", "/1/1/1");
await cl.start({
  flow: "client_register", need: "organist",
  NAME: "משה לוי", CITY: "ירושלים", BUILDING: "12", HALL: "אולם הנרות", STYLE: "1",
  DATE: "010130", START: "2000", END: "2300", PA: "1", MAXORG: "1000", OVER: "2", PHONE: "0522222222", TZ: "2",
});
await cl.answers("1", "x", "x", "1", "1", "1"); // עיר, שכונה, רחוב, סגנון, טלפונים, התחייבות
check(db.t.requests?.length === 1, "הבקשה נשמרה");
check(/נמצאו 1 בעלי מקצוע/.test(cl.last.replace(/&go_to_folder.*/, "")), "נמצא בעל מקצוע מתאים אחד");
check(toRoot(cl), "חזרה לתפריט הראשי בקו");

console.log("הצעה אוטומטית נוצרת בלי התערבות");
const auto = db.t.offers || [];
check(auto.length === 1 && auto[0].auto === true && auto[0].amount === 800, "נוצרה הצעה אוטומטית במחיר המינימלי של בעל המקצוע");
check(Number(auto[0]?.score) > 0, `לההצעה ציון התאמה (${auto[0]?.score})`);

console.log("הלקוח שומע את ההצעה ומאשר");
const cl2 = new Call("0522222222", "/3");
await cl2.start({ flow: "personal" });
await cl2.answers("1");
check(/הצעה 1 מתוך 1/.test(cl2.last) && /800 שקלים/.test(cl2.last), "ההצעה נשמעת ללקוח");
await cl2.answers("2", "1");
check((db.t.offers || [])[0].status === "accepted", "ההצעה אושרה");
check((db.t.offers || [])[0].fee_client === 80, "עמלה חושבה (10% על הלקוח = 80)");

console.log("בקשה מעיר אחרת לא מתאימה");
const cl3 = new Call("0533333333", "/1/1/1");
await cl3.start({ flow: "client_register", need: "organist", NAME: "דני", CITY: "בני ברק", BUILDING: "5", HALL: "אולם", STYLE: "1", DATE: "010130", START: "2000", END: "2300", PA: "1", MAXORG: "1000", OVER: "2", PHONE: "0533333333", TZ: "2" });
await cl3.answers("1", "x", "x", "1", "1", "1");
check(/כרגע לא נמצאו/.test(cl3.last), "אין התאמה לעיר אחרת");

console.log("תשלום ושותפים");
const pay = new Call("0501111111", "/4");
await pay.start({ flow: "pay", AMOUNT: "5000", CODE: "" });
await pay.answers("1");
check(/500/.test(pay.last), "עמלה לתשלום חושבה (500)");
const part = new Call("0509999999", "/7");
await part.start({ flow: "partner", BANK: "12", BRANCH: "345", ACCOUNT: "123456" });
await part.answers("1", "1", "1");
check((db.t.partners || []).length === 1, "שותף נשמר עם קוד");

console.log(fails ? `\n${fails} בדיקות נכשלו` : "\nכל הבדיקות עברו");
process.exit(fails ? 1 : 0);
