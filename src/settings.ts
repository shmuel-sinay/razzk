import type { Db } from "./types";

/** ברירות מחדל. כל ערך ניתן לשינוי באתר הניהול (טבלת settings). */
export const DEFAULTS: Record<string, { value: string; label: string; group: string }> = {
  fee_percent: { value: "10", label: "אחוז עמלה כולל מסכום העסקה", group: "עמלות" },
  fee_payer: { value: "client", label: "מי משלם את העמלה: client (לקוח) / pro (בעל מקצוע) / both (שניהם)", group: "עמלות" },
  fee_client_share: { value: "50", label: "כשהשניים משלמים: איזה אחוז מהעמלה משלם הלקוח (השאר בעל המקצוע)", group: "עמלות" },
  over_budget_percent: { value: "15", label: "אחוז חריגה מותר מהתקציב כשהלקוח מאשר", group: "עמלות" },
  payment_enabled: { value: "false", label: "תשלום פעיל? (true/false) — כרגע כבוי עד שתהיה סליקה", group: "תשלום" },
  reveal_contact_without_payment: { value: "true", label: "למסור פרטי קשר בלי תשלום (לניסויים בלבד)", group: "תשלום" },
  recordings_folder: { value: "/recordings", label: "תיקיית ההקלטות בקו בימות המשיח", group: "מערכת" },
  tzintuk_caller_id: { value: "", label: "מספר יוצא לצינתוקים (אחרי אישור מזהה שיחה בימות)", group: "מערכת" },
  text_main_menu: {
    value: "ברוכים הבאים למערכת התיווך לאורגניסטים וזמרים. לבקשת אורגניסט או זמר הקישו 1. להרשמה כאורגניסט או זמר הקישו 2. לאזור האישי הקישו 3. לתשלום הקישו 4. להשארת הודעה למנהלי המערכת הקישו 6. לתוכנית השותפים הקישו 7.",
    label: "תפריט ראשי", group: "הודעות",
  },
  text_intro_pro: {
    value: "ברוכים הבאים להרשמת בעלי מקצוע. המערכת מקשרת בין בעלי מקצוע ללקוחות. בעל מקצוע שיסגור עסקה דרך המערכת מתחייב לשלם את העמלה שנקבעה.",
    label: "הודעת פתיחה — הרשמת בעלי מקצוע (נשמעת פעם אחת)", group: "הודעות",
  },
  text_intro_client: {
    value: "ברוכים הבאים לבקשת אורגניסט או זמר. הזינו את פרטי האירוע, והמערכת תפנה לבעלי מקצוע מתאימים. הצעות יושמעו לכם באזור האישי.",
    label: "הודעת פתיחה — לקוחות (נשמעת פעם אחת)", group: "הודעות",
  },
  text_terms_question: { value: "האם אתם מאשרים ומקבלים עליכם את כל התנאים? לאישור הקישו 1, לסירוב הקישו 2.", label: "שאלת אישור תנאים", group: "הודעות" },
  text_commit_pro: { value: "האם אתם מתחייבים לתנאי המערכת ולתשלום העמלה? לאישור הקישו 1, לביטול וחזרה הקישו 2.", label: "התחייבות סופית — בעל מקצוע", group: "הודעות" },
  text_commit_client: { value: "האם אתם מתחייבים לתנאי המערכת ולתשלום העמלה? לאישור הקישו 1, לביטול וחזרה הקישו 2.", label: "התחייבות סופית — לקוח", group: "הודעות" },
  text_partners: { value: "תוכנית השותפים תיפתח בקרוב. לפרטים השאירו הודעה למנהלי המערכת.", label: "תוכנית שותפים", group: "הודעות" },
  text_payment_soon: { value: "התשלום באמצעות המערכת יופעל בקרוב. אנא פנו למנהלי המערכת.", label: "תשלום עדיין לא פעיל", group: "הודעות" },
};

export type Settings = Record<string, string>;

export async function loadSettings(db: Db): Promise<Settings> {
  const out: Settings = {};
  for (const [k, v] of Object.entries(DEFAULTS)) out[k] = v.value;
  for (const r of await db.list("settings")) out[r.key] = r.value;
  return out;
}

/** חישוב העמלה לפי הגדרות האתר */
export function calcFee(amount: number, s: Settings): { client: number; pro: number; total: number } {
  const total = Math.round((amount * Number(s.fee_percent || 0)) / 100);
  if (s.fee_payer === "client") return { client: total, pro: 0, total };
  if (s.fee_payer === "pro") return { client: 0, pro: total, total };
  const c = Math.round((total * Number(s.fee_client_share || 50)) / 100);
  return { client: c, pro: total - c, total };
}
