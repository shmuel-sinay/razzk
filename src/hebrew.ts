/** נרמול טקסט עברי להשוואה: בלי ניקוד, גרשיים, רווחים ומקפים */
export function normalize(s: string): string {
  return (s || "")
    .replace(/[֑-ׇ]/g, "")
    .replace(/["'`״׳\-־\s.,()]/g, "")
    .replace(/תקווה/g, "תקוה")
    .replace(/קרית/g, "קריית")
    .trim();
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function similarity(a: string, b: string): number {
  const x = normalize(a), y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  return 1 - lev(x, y) / Math.max(x.length, y.length);
}

/** מחזיר את הערך הדומה ביותר מתוך רשימה, או null אם אין התאמה סבירה */
export function bestMatch<T extends { name: string }>(input: string, items: T[], min = 0.6): T | null {
  let best: T | null = null, score = 0;
  for (const it of items) {
    const s = similarity(input, it.name);
    if (s > score) { score = s; best = it; }
  }
  return score >= min ? best : null;
}

const MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
export const DAY_NAMES: Record<number, string> = {
  1: "ראשון", 2: "שני", 3: "שלישי", 4: "רביעי", 5: "חמישי", 6: "שישי", 7: "מוצאי שבת",
};

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ב${MONTHS[m - 1]} ${y}`;
}

export function fmtTime(hhmm: string): string {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
}

/** יום בשבוע במספור של המערכת: 1=ראשון ... 6=שישי, 7=שבת/מוצאי שבת */
export function systemWeekday(iso: string): number {
  const d = new Date(iso + "T12:00:00Z").getUTCDay(); // 0=ראשון
  return d === 6 ? 7 : d + 1;
}
