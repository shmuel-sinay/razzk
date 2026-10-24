import type { Row } from "../types";
import { calcFee } from "../settings";
import { budgetFor, proMatches } from "../match";
import { fmtDate, fmtTime, DAY_NAMES } from "../hebrew";
import { sendTzintuk } from "../yemot";
import { type Ctx, type Sess, t, f, say, readDigits, readRecord, isEmpty } from "./core";
import { type Field, type FormDef, runForm } from "./forms";

const STYLE_NAME: Record<string, string> = { hasidic: "חסידי", mizrahi: "מזרחי", both: "שני הסגנונות" };
const ROLE_NAME: Record<string, string> = { organist: "אורגניסט", organist_singer: "אורגניסט וזמר", singer: "זמר" };
const spell = (n: string) => n.split("").join(" ");

// ───────────────────────── חזרה לתפריט הראשי (בימות) ─────────────────────────

/** מסיים את השלב בשרת וחוזר לתפריט הראשי שבקו. הודעות שנצברו מושמעות לפני החזרה. */
export function mainMenu(_ctx: Ctx, s: Sess): string {
  s.node = "done"; s.data = {}; s.expect = undefined;
  const parts = s.pre; s.pre = [];
  return (parts.length ? `id_list_message=${parts.join(".")}&` : "") + "go_to_folder=/";
}

// ───────────────────────── הרשמה ─────────────────────────

const yn = (key: string, prompt: string, extra: Partial<Field> = {}): Field => ({ key, kind: "yesno", prompt, ...extra });

function proFields(ctx: Ctx): Field[] {
  return [
    { key: "name", kind: "text", prompt: "אנא אמרו את שמכם ואת שם משפחתכם." },
    { key: "age", kind: "number", prompt: "הקישו את גילכם ובסיומו סולמית.", min: 1, max: 2, validate: (n) => n >= 14 && n <= 99 },
    { key: "city", kind: "city", voiceTries: 3, prompt: "אנא אמרו את שם העיר או הישוב בו תרצו לתת שירות." },
    { key: "neighborhood_audio", kind: "record", prompt: "אנא אמרו את שם השכונה ובסיום הקישו סולמית.", recSec: 10, recPrefix: "neigh" },
    {
      key: "style", kind: "choice", confirm: true,
      prompt: "לסגנון נגינה חסידי הקישו 1. למזרחי הקישו 2. לשני הסגנונות הקישו 3.",
      choices: [{ d: "1", label: "חסידי", value: "hasidic" }, { d: "2", label: "מזרחי", value: "mizrahi" }, { d: "3", label: "שני הסגנונות", value: "both" }],
    },
    {
      key: "days", kind: "days",
      prompt: "הקישו את הימים בהם יש לכם זמינות בדרך כלל. ראשון 1. שני 2. שלישי 3. רביעי 4. חמישי 5. שישי 6. מוצאי שבת 7. כל הימים 8. הקישו ברצף ובסיום סולמית.",
    },
    { key: "bio_audio", kind: "record", prompt: "ספרו על ההתמקצעות שלכם, עד שלושים שניות. ההקלטה תושמע ללקוחות. בסיום הקישו סולמית.", recSec: 30, recPrefix: "bio" },
    { key: "hours", kind: "hours", prompt: "הקישו שעת התחלת הזמינות" },
    yn("has_pa", "יש לכם הגברה? כן הקישו 1. לא הקישו 2."),
    { key: "min_price", kind: "number", prompt: "הקישו את הסכום המינימלי לאירוע בשקלים ובסיומו סולמית.", min: 1, max: 6, fmt: (n) => `${n} שקלים` },
    { key: "phones", kind: "phones", prompt: "הקישו את מספר הטלפון אליו תרצו לקבל הזמנות" },
    {
      key: "email_ok", kind: "choice",
      prompt: "האם תהיו מוכנים לשלוח במייל הקלטה של הנגינה שלכם ללקוח שיבקש? כן הקישו 1. לא הקישו 2. אם יהיה לי זמין הקישו 3.",
      choices: [{ d: "1", label: "כן", value: "yes" }, { d: "2", label: "לא", value: "no" }, { d: "3", label: "אם יהיה זמין", value: "maybe" }],
    },
    yn("tzintuk_ok", "האם אתם מאשרים לקבל צינתוקים מהמערכת? כן הקישו 1. לא הקישו 2."),
    yn("commit", ctx.settings.text_commit_pro),
  ];
}

function clientFields(ctx: Ctx, need: string): Field[] {
  return [
    { key: "name", kind: "text", prompt: "אנא אמרו את שמכם ואת שם משפחתכם." },
    { key: "city", kind: "city", voiceTries: 3, prompt: "אנא אמרו את שם העיר או הישוב בו יתקיים האירוע." },
    { key: "neighborhood_audio", kind: "record", prompt: "אנא אמרו את שם השכונה ובסיום הקישו סולמית.", recSec: 10, recPrefix: "neigh" },
    { key: "street_audio", kind: "record", prompt: "אנא אמרו את שם הרחוב ובסיום הקישו סולמית.", recSec: 10, recPrefix: "street" },
    { key: "building", kind: "number", prompt: "הקישו את מספר הבניין בו נמצא האולם ובסיומו סולמית.", min: 1, max: 4 },
    { key: "hall_name", kind: "text", voiceTries: 3, prompt: "אנא אמרו את שם האולם." },
    {
      key: "style", kind: "choice", confirm: true,
      prompt: "לסגנון נגינה חסידי הקישו 1. למזרחי הקישו 2. לשני הסגנונות הקישו 3.",
      choices: [{ d: "1", label: "חסידי", value: "hasidic" }, { d: "2", label: "מזרחי", value: "mizrahi" }, { d: "3", label: "שני הסגנונות", value: "both" }],
    },
    { key: "event_date", kind: "date", prompt: "הקישו את תאריך האירוע בשש ספרות: יום, חודש ושנה, ובסיום סולמית. למשל חמישה עשר במרץ אלפיים עשרים ושבע הוא אפס חמש אפס שלוש שתיים שבע." },
    { key: "start_time", kind: "time", prompt: "הקישו את שעת תחילת האירוע בארבע ספרות." },
    { key: "end_time", kind: "time", prompt: "הקישו את שעת סיום האירוע בארבע ספרות." },
    yn("has_pa", "יש לכם הגברה באולם? כן הקישו 1. לא הקישו 2."),
    { key: "max_organist", kind: "number", prompt: "הקישו את הסכום המקסימלי לאורגניסט בשקלים ובסיומו סולמית.", min: 1, max: 6, fmt: (n) => `${n} שקלים` },
    { key: "max_singer", kind: "number", prompt: "הקישו את הסכום המקסימלי לזמר בשקלים ובסיומו סולמית.", min: 1, max: 6, fmt: (n) => `${n} שקלים`, skip: () => need === "organist" },
    yn("allow_over", `האם תרצו לקבל גם הצעה החורגת עד ${ctx.settings.over_budget_percent} אחוזים מהסכום? כן הקישו 1. לא הקישו 2.`),
    { key: "phones", kind: "phones", prompt: "הקישו את מספר הטלפון אליו תרצו לקבל הצעות" },
    yn("tzintuk_ok", "האם אתם מאשרים לקבל צינתוקים מהמערכת? כן הקישו 1. לא הקישו 2."),
    yn("commit", ctx.settings.text_commit_client),
  ];
}

function proRow(ctx: Ctx, v: Row): Row {
  const r: Row = {};
  for (const k of ["name", "age", "neighborhood_audio", "style", "bio_audio", "has_pa", "min_price", "tzintuk_ok"]) if (k in v) r[k] = v[k];
  if (v.city) { r.city_id = v.city.id; r.city_name = v.city.name; }
  if (v.days) r.days = v.days;
  if (v.hours) r.hours = v.hours;
  if (v.phones) r.contact_phones = v.phones;
  if (v.email_ok) r.email_recording = v.email_ok;
  return r;
}

/** טפסים לפי מזהה — נבנים מחדש בכל בקשה כי הם תלויים בהגדרות */
export function buildForm(ctx: Ctx, id: string, p: Row): FormDef {
  const abort = async (_c: Ctx, s: Sess) => { say(s, t("הפעולה בוטלה.")); return mainMenu(ctx, s); };
  switch (id) {
    case "pro":
      return {
        fields: proFields(ctx),
        onAbort: abort,
        onDone: async (c, s, v) => {
          if (!v.commit) return abort(c, s);
          await c.db.upsert("professionals", { phone: c.phone, role: p.role, active: true, ...proRow(c, v) }, "phone");
          say(s, t("ההרשמה הושלמה בהצלחה. תודה."));
          return mainMenu(c, s);
        },
      };
    case "proedit": {
      const fld = proFields(ctx).find((x) => x.key === p.key)!;
      return {
        fields: [fld], onAbort: abort,
        onDone: async (c, s, v) => {
          await c.db.update("professionals", { phone: c.phone }, proRow(c, v));
          say(s, t("הפרטים עודכנו."));
          s.data = { role: "pro" };
          return personalMenu(c, s);
        },
      };
    }
    case "client_rename":
      return {
        fields: [{ key: "name", kind: "text", prompt: "אנא אמרו את שמכם ואת שם משפחתכם." }],
        onAbort: abort,
        onDone: async (c, s, v) => {
          await c.db.upsert("clients", { phone: c.phone, name: v.name }, "phone");
          say(s, t("הפרטים עודכנו."));
          s.data = { role: "client" };
          return personalMenu(c, s);
        },
      };
    case "client":
      return {
        fields: clientFields(ctx, p.need), onAbort: abort,
        onDone: async (c, s, v) => {
          if (!v.commit) return abort(c, s);
          await c.db.upsert("clients", { phone: c.phone, name: v.name, tzintuk_ok: v.tzintuk_ok }, "phone");
          const req = await c.db.insert("requests", {
            client_phone: c.phone, client_name: v.name, need: p.need, status: "open",
            city_id: v.city.id, city_name: v.city.name,
            neighborhood_audio: v.neighborhood_audio, street_audio: v.street_audio,
            building: String(v.building), hall_name: v.hall_name, style: v.style,
            event_date: v.event_date, start_time: v.start_time, end_time: v.end_time,
            has_pa: v.has_pa, max_organist: v.max_organist, max_singer: v.max_singer ?? null,
            allow_over: v.allow_over, contact_phones: v.phones, tzintuk_ok: v.tzintuk_ok,
          });
          const n = await notifyMatches(c, req);
          say(s, t(n ? `הבקשה נקלטה. נמצאו ${n} בעלי מקצוע מתאימים. הם יקבלו עדכון, וההצעות יושמעו לכם באזור האישי.` : "הבקשה נקלטה. כרגע לא נמצאו בעלי מקצוע מתאימים. כשיתווספו, ההצעות יושמעו לכם באזור האישי."));
          return mainMenu(c, s);
        },
      };
    case "msg":
      return {
        fields: [{ key: "audio", kind: "record", prompt: "אנא השאירו הודעה למנהלי המערכת ובסיום הקישו סולמית.", recSec: 60, recPrefix: "admin" }],
        onAbort: abort,
        onDone: async (c, s, v) => {
          if (v.audio) await c.db.insert("admin_messages", { phone: c.phone, audio: v.audio });
          say(s, t("ההודעה נשלחה. תודה."));
          return mainMenu(c, s);
        },
      };
    case "partner":
      return {
        fields: [
          { key: "bank", kind: "number", prompt: "הקישו את מספר הבנק ובסיומו סולמית.", min: 1, max: 3 },
          { key: "branch", kind: "number", prompt: "הקישו את מספר הסניף ובסיומו סולמית.", min: 1, max: 4 },
          { key: "account", kind: "number", prompt: "הקישו את מספר החשבון ובסיומו סולמית.", min: 1, max: 10 },
        ],
        onAbort: abort,
        onDone: async (c, s, v) => {
          const code = String(1000 + Math.floor(Math.random() * 9000));
          await c.db.insert("partners", { phone: c.phone, code, bank: String(v.bank), branch: String(v.branch), account: String(v.account) });
          say(s, t(`הפרטים נשמרו. הקוד שלכם למסירה ללקוחות הוא ${spell(code)}. אני חוזר, ${spell(code)}.`));
          return mainMenu(c, s);
        },
      };
    case "pay":
      return {
        fields: [
          { key: "amount", kind: "number", prompt: "הקישו את הסכום שסגרתם בשקלים ובסיומו סולמית.", min: 1, max: 6, fmt: (n) => `${n} שקלים` },
          yn("via", "האם הגעתם דרך מישהו? כן הקישו 1. לא הקישו 2."),
          { key: "code", kind: "number", prompt: "הקישו את הקוד שמסר לכם המפרסם ובסיומו סולמית.", min: 1, max: 6, skip: (v) => !v.via },
        ],
        onAbort: abort,
        onDone: async (c, s, v) => {
          const fee = calcFee(v.amount, c.settings);
          say(s, t(`העמלה לתשלום היא ${fee.total} שקלים.`));
          say(s, t(c.settings.text_payment_soon));
          return mainMenu(c, s);
        },
      };
  }
  throw new Error("unknown form " + id);
}

function startForm(ctx: Ctx, s: Sess, id: string, params: Row = {}, pre: Row = {}): Promise<string> {
  s.node = "form";
  s.data = { formId: id, params, i: 0, vals: {}, fails: 0, pre };
  return runForm(ctx, s, buildForm(ctx, id, params), null);
}

// ───────────────────────── חישוב התאמות והתראות ─────────────────────────

async function matchingPros(ctx: Ctx, req: Row): Promise<Row[]> {
  const over = Number(ctx.settings.over_budget_percent || 15);
  const all = await ctx.db.list("professionals", { match: { active: true }, limit: 5000 });
  return all.filter((p) => proMatches(p, req, over));
}

async function notifyMatches(ctx: Ctx, req: Row): Promise<number> {
  const pros = await matchingPros(ctx, req);
  const phones = pros.filter((p) => p.tzintuk_ok).map((p) => p.phone);
  await sendTzintuk(ctx.env, ctx.settings, phones);
  return pros.length;
}

// ───────────────────────── אזור אישי ─────────────────────────

export async function personalEntry(ctx: Ctx, s: Sess): Promise<string> {
  const pro = await ctx.db.get("professionals", { phone: ctx.phone });
  const reqs = await ctx.db.list("requests", { match: { client_phone: ctx.phone }, limit: 1 });
  const client = reqs.length > 0 || !!(await ctx.db.get("clients", { phone: ctx.phone }));
  if (!pro && !client) {
    say(s, t("מספר הטלפון שלכם לא רשום במערכת."));
    return mainMenu(ctx, s);
  }
  if (pro && client) {
    s.node = "personal_pick";
    return readDigits(s, [t("לבעל מקצוע הקישו 1. ללקוח הקישו 2.")], { min: 1, max: 1, allowed: "12" });
  }
  s.data = { role: pro ? "pro" : "client" };
  return personalMenu(ctx, s);
}

function personalMenu(ctx: Ctx, s: Sess): string {
  s.node = "personal";
  const role = s.data.role;
  s.data = { role };
  return readDigits(
    s,
    [t(role === "pro"
      ? "לבקשות מתאימות הקישו 1. לתיקון פרטים הקישו 2. למחיקה מהמערכת הקישו 3. לחזרה לתפריט הראשי הקישו 9."
      : "להצעות שקיבלתי הקישו 1. לתיקון הפרטים הקישו 2. למחיקה מהמערכת הקישו 3. לחזרה לתפריט הראשי הקישו 9.")],
    { min: 1, max: 1, allowed: "1239" },
  );
}

const PRO_EDIT: [string, string][] = [
  ["name", "שם ומשפחה"], ["age", "גיל"], ["city", "עיר"], ["neighborhood_audio", "שכונה"], ["style", "סגנון נגינה"],
  ["days", "ימי זמינות"], ["bio_audio", "פרטים על ההתמקצעות"], ["hours", "שעות זמינות"], ["has_pa", "הגברה"],
  ["min_price", "סכום מינימלי"], ["phones", "מספרי טלפון"], ["email_ok", "שליחת הקלטה במייל"], ["tzintuk_ok", "צינתוקים"],
];

async function offersView(ctx: Ctx, s: Sess): Promise<string> {
  const d = s.data;
  const id = d.ids[d.i];
  if (!id) {
    say(s, t(d.ids.length ? "אלו היו כל ההצעות." : "אין הצעות כרגע."));
    return personalMenu(ctx, s);
  }
  const o = await ctx.db.get("offers", { id });
  const pro = o ? await ctx.db.get("professionals", { id: o.pro_id }) : null;
  if (!o || !pro) { d.i++; return offersView(ctx, s); }
  s.node = "offers";
  const parts = [
    t(`הצעה ${d.i + 1} מתוך ${d.ids.length}. ${pro.name || "בעל מקצוע"}. ${ROLE_NAME[pro.role]}. סגנון ${STYLE_NAME[pro.style] || ""}.`),
    ...(pro.bio_audio ? [f(pro.bio_audio)] : []),
    ...(o.message_audio ? [f(o.message_audio)] : []),
    t(`הסכום המבוקש ${o.amount} שקלים. להצעה הבאה הקישו 1. להתחייבות ואישור ההצעה הקישו 2. להשמעה חוזרת הקישו 3. לחזרה הקישו 9.`),
  ];
  return readDigits(s, parts, { min: 1, max: 1, allowed: "1239" });
}

async function reqsView(ctx: Ctx, s: Sess): Promise<string> {
  const d = s.data;
  const id = d.ids[d.i];
  if (!id) {
    say(s, t(d.ids.length ? "אלו היו כל הבקשות." : "אין בקשות מתאימות כרגע."));
    return personalMenu(ctx, s);
  }
  const r = await ctx.db.get("requests", { id });
  const pro = await ctx.db.get("professionals", { phone: ctx.phone });
  if (!r || !pro) { d.i++; return reqsView(ctx, s); }
  s.node = "reqs"; d.phase = "view";
  const budget = budgetFor(pro.role, r, Number(ctx.settings.over_budget_percent || 15));
  return readDigits(s, [
    t(`בקשה ${d.i + 1} מתוך ${d.ids.length}. ${r.city_name}. ${fmtDate(r.event_date)}. משעה ${fmtTime(r.start_time)} עד ${fmtTime(r.end_time)}. סגנון ${STYLE_NAME[r.style]}. אולם ${r.hall_name || ""}. התקציב ${budget} שקלים.`),
    ...(r.neighborhood_audio ? [t("שכונה."), f(r.neighborhood_audio)] : []),
    t("להגשת הצעה הקישו 1. לבקשה הבאה הקישו 2. לחזרה הקישו 9."),
  ], { min: 1, max: 1, allowed: "129" });
}

async function acceptOffer(ctx: Ctx, s: Sess, offerId: string): Promise<string> {
  const o = await ctx.db.get("offers", { id: offerId });
  if (!o) return personalMenu(ctx, s);
  const fee = calcFee(o.amount, ctx.settings);
  await ctx.db.update("offers", { id: offerId }, { status: "accepted", fee_client: fee.client, fee_pro: fee.pro });
  const pro = await ctx.db.get("professionals", { id: o.pro_id });
  if (pro) await sendTzintuk(ctx.env, ctx.settings, [pro.phone]);
  if (ctx.settings.payment_enabled !== "true" && ctx.settings.reveal_contact_without_payment === "true" && pro) {
    const nums = (pro.contact_phones || []).map((n: string) => spell(n)).join(" . ");
    say(s, t(`ההצעה אושרה. מספר הטלפון של ${pro.name || "בעל המקצוע"} הוא ${nums}.`));
  } else {
    say(s, t("ההצעה אושרה. פרטי בעל המקצוע יימסרו לאחר התשלום."));
  }
  return personalMenu(ctx, s);
}

// ───────────────────────── נתב ראשי ─────────────────────────

export async function route(ctx: Ctx, s: Sess, raw: string | undefined): Promise<string> {
  const v = (raw ?? "").trim();
  const nothing = isEmpty(raw);

  switch (s.node) {
    case "form": {
      const form = buildForm(ctx, s.data.formId, s.data.params);
      return runForm(ctx, s, form, raw ?? "");
    }

    case "personal_pick":
      s.data = { role: v === "1" ? "pro" : "client" };
      return personalMenu(ctx, s);

    case "personal": {
      const role = s.data.role;
      if (v === "9" || nothing) return mainMenu(ctx, s);
      if (v === "1" && role === "client") {
        const reqs = await ctx.db.list("requests", { match: { client_phone: ctx.phone } });
        const ids: string[] = [];
        for (const r of reqs) {
          const offs = await ctx.db.list("offers", { match: { request_id: r.id }, order: "created_at.desc" });
          ids.push(...offs.map((o) => o.id));
        }
        s.data = { role, ids, i: 0 };
        return offersView(ctx, s);
      }
      if (v === "1" && role === "pro") {
        const pro = await ctx.db.get("professionals", { phone: ctx.phone });
        const mine = new Set((await ctx.db.list("offers", { match: { pro_id: pro?.id } })).map((o) => o.request_id));
        const today = new Date().toISOString().slice(0, 10);
        const open = (await ctx.db.list("requests", { match: { status: "open" }, order: "created_at.desc", limit: 500 }))
          .filter((r) => r.event_date >= today && !mine.has(r.id) && pro && proMatches(pro, r, Number(ctx.settings.over_budget_percent || 15)));
        s.data = { role, ids: open.map((r) => r.id), i: 0 };
        return reqsView(ctx, s);
      }
      if (v === "2" && role === "pro") {
        s.node = "pro_edit_pick";
        const list = PRO_EDIT.map(([, l], i) => `${l} ${i + 1}`).join(". ");
        return readDigits(s, [t(`איזה פרט לתקן? ${list}. ובסיום סולמית.`)], { min: 1, max: 2 });
      }
      if (v === "2" && role === "client") return startForm(ctx, s, "client_rename");
      if (v === "3") {
        s.node = "delete_confirm";
        return readDigits(s, [t("למחיקה מהמערכת הקישו 1. לביטול הקישו 2.")], { min: 1, max: 1, allowed: "12" });
      }
      return personalMenu(ctx, s);
    }

    case "pro_edit_pick": {
      const item = PRO_EDIT[Number(v) - 1];
      if (!item) return personalMenu(ctx, s);
      return startForm(ctx, s, "proedit", { key: item[0] });
    }

    case "delete_confirm": {
      const role = s.data.role;
      if (v === "1") {
        if (role === "pro") await ctx.db.remove("professionals", { phone: ctx.phone });
        else { await ctx.db.remove("requests", { client_phone: ctx.phone }); await ctx.db.remove("clients", { phone: ctx.phone }); }
        say(s, t("הפרטים נמחקו מהמערכת."));
        return mainMenu(ctx, s);
      }
      return personalMenu(ctx, s);
    }

    case "offers": {
      const d = s.data;
      if (v === "1") { d.i++; return offersView(ctx, s); }
      if (v === "3") return offersView(ctx, s);
      if (v === "2") {
        s.node = "offer_commit";
        return readDigits(s, [t(ctx.settings.text_commit_client)], { min: 1, max: 1, allowed: "12" });
      }
      return personalMenu(ctx, s);
    }

    case "offer_commit": {
      const d = s.data;
      if (v === "1") return acceptOffer(ctx, s, d.ids[d.i]);
      return offersView(ctx, s);
    }

    case "reqs": {
      const d = s.data;
      if (v === "2") { d.i++; return reqsView(ctx, s); }
      if (v === "1") {
        s.node = "offer_amount";
        return readDigits(s, [t("הקישו את הסכום שתבקשו לאירוע בשקלים ובסיומו סולמית.")], { min: 1, max: 6 });
      }
      return personalMenu(ctx, s);
    }

    case "offer_amount": {
      const d = s.data;
      if (!/^\d+$/.test(v) || !+v) return readDigits(s, [t("הקישו את הסכום שתבקשו לאירוע בשקלים ובסיומו סולמית.")], { min: 1, max: 6 });
      d.amount = +v;
      s.node = "offer_msg";
      return readRecord(s, [t("אפשר להקליט הודעה ללקוח, עד שלושים שניות, ובסיום להקיש סולמית. אם אין צורך, הקישו סולמית מיד.")],
        ctx.settings.recordings_folder, (d.file = `offer_${ctx.phone}_${Date.now().toString(36)}`), 30);
    }

    case "offer_msg": {
      const d = s.data;
      const pro = await ctx.db.get("professionals", { phone: ctx.phone });
      if (pro) {
        await ctx.db.insert("offers", {
          request_id: d.ids[d.i], pro_id: pro.id, amount: d.amount, status: "sent",
          message_audio: nothing ? null : `${ctx.settings.recordings_folder}/${d.file}`,
        });
        const r = await ctx.db.get("requests", { id: d.ids[d.i] });
        if (r?.tzintuk_ok) await sendTzintuk(ctx.env, ctx.settings, r.contact_phones || []);
      }
      say(s, t("ההצעה נשלחה ללקוח."));
      d.i++;
      return reqsView(ctx, s);
    }
  }
  return mainMenu(ctx, s);
}

export { DAY_NAMES };

// ───────────────────────── התחלת שלוחת api מימות ─────────────────────────

/** ימות אספה את התשובות לפי api_NNN ושלחה אותן יחד. כאן בודקים אותן ומשלימים מה שחסר. */
export async function startFlow(ctx: Ctx, s: Sess, p: Record<string, string>): Promise<string> {
  const v = (k: string) => (isEmpty(p[k]) ? undefined : p[k].trim());
  const drop = (o: Row) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined));
  switch (p.flow) {
    case "pro_register":
      return startForm(ctx, s, "pro", { role: p.role }, drop({
        name: v("NAME"), age: v("AGE"), city: v("CITY"), style: v("STYLE"), days: v("DAYS"),
        hours: v("HSTART") && v("HEND") ? { start: v("HSTART"), end: v("HEND") } : undefined,
        has_pa: v("PA"), min_price: v("MINPRICE"), phones: v("PHONE"), email_ok: v("EMAILOK"), tzintuk_ok: v("TZ"),
      }));
    case "client_register":
      return startForm(ctx, s, "client", { need: p.need }, drop({
        name: v("NAME"), city: v("CITY"), building: v("BUILDING"), hall_name: v("HALL"), style: v("STYLE"),
        event_date: v("DATE"), start_time: v("START"), end_time: v("END"), has_pa: v("PA"),
        max_organist: v("MAXORG"), max_singer: v("MAXSING"), allow_over: v("OVER"), phones: v("PHONE"), tzintuk_ok: v("TZ"),
      }));
    case "pay":
      return startForm(ctx, s, "pay", {}, drop({ amount: v("AMOUNT"), via: v("CODE") ? "1" : "2", code: v("CODE") }));
    case "partner":
      return startForm(ctx, s, "partner", {}, drop({ bank: v("BANK"), branch: v("BRANCH"), account: v("ACCOUNT") }));
    case "personal":
      return personalEntry(ctx, s);
  }
  return mainMenu(ctx, s);
}
