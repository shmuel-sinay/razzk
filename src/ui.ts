import type { Row } from "./types";
import { CSS, JS } from "./assets";

export const esc = (v: any) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// ───────────── תוויות ותצוגה ─────────────

export const ROLE: Record<string, string> = { organist: "אורגניסט", organist_singer: "אורגניסט וזמר", singer: "זמר" };
export const STYLE: Record<string, string> = { hasidic: "חסידי", mizrahi: "מזרחי", both: "שני הסגנונות" };
export const DAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "מוצ״ש"];
export const DAY_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "מוצאי שבת"];

const ICONS: Record<string, string> = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c2 .6 3.3 2.4 3.5 5.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  match: '<path d="M8 12a4 4 0 114 4M16 12a4 4 0 10-4-4"/><path d="M12 8v8"/>',
  offer: '<path d="M4 7h16v10H4zM4 11h16M9 15h2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9c-2-4-6-4-6-1.5S9 9 12 9zm0 0c2-4 6-4 6-1.5S15 9 12 9z"/>',
  map: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.600-7 10-7 10z"/>',
};
export const icon = (n: string, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;

export const badge = (text: string, tone = "") => `<span class="badge ${tone}">${esc(text)}</span>`;
/** כמו badge אבל עם HTML שכבר נוקה (למשל טווח שעות עם כיוון משלו) */
export const badgeHtml = (html: string, tone = "") => `<span class="badge ${tone}">${html}</span>`;
/** טווח שעות בכיוון שמאל-לימין כדי שלא יתהפך בעברית */
export const rng = (a: string, b: string) => `<bdi dir="ltr">${hh(a)}–${hh(b)}</bdi>`;
export const avatar = (name: string) => `<div class="av">${esc((name || "?").trim().slice(0, 1))}</div>`;
export const stars = (n: any) => {
  const v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return `<span class="stars" title="${v} מתוך 5">${"★".repeat(v)}<s>${"★".repeat(5 - v)}</s></span>`;
};
export const daysView = (days: number[] = []) =>
  `<span class="days">${DAY_SHORT.map((d, i) => `<i class="${days.includes(i + 1) ? "on" : ""}" title="${DAY_FULL[i]}">${d.slice(0, 1)}</i>`).join("")}</span>`;
export const hh = (t: string) => (t && t.length === 4 ? `${t.slice(0, 2)}:${t.slice(2)}` : t || "");
export const hoursView = (hours: Row[] = []) =>
  hours.length ? hours.map((h) => `<span dir="ltr" class="badge">${hh(h.start)}–${hh(h.end)}</span>`).join(" ") : '<span class="muted">—</span>';
export const yesNo = (v: any) => (v ? badge("כן", "ok") : badge("לא"));

// ───────────── מעטפת ניהול ─────────────

export const NAV: [string, string, string, string?][] = [
  ["", "סקירה", "home"],
  ["matches", "התאמות", "match", "פעילות"],
  ["requests", "בקשות", "cal"],
  ["offers", "הצעות", "offer"],
  ["pros", "בעלי מקצוע", "music", "אנשים"],
  ["clients", "לקוחות", "users"],
  ["partners", "שותפים", "gift"],
  ["messages", "הודעות", "mail", "מערכת"],
  ["neighborhoods", "שכונות", "pin"],
  ["cities", "ערים", "map"],
  ["settings", "הגדרות והודעות", "cog"],
];

export function page(title: string, body: string, active?: string): string {
  const cur = active ?? (NAV.find(([, l]) => title.startsWith(l))?.[0] ?? "");
  let grp = "";
  const links = NAV.map(([p, l, ic, g]) => {
    const head = g && g !== grp ? `<div class="grp">${g}</div>` : "";
    if (g) grp = g;
    return `${head}<a href="/admin/${p}" class="${cur === p ? "on" : ""}">${icon(ic)}${l}</a>`;
  }).join("");
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — ניהול</title>
<style>${CSS}</style></head><body>
<input type="checkbox" id="nav-toggle"><label for="nav-toggle" class="burger">☰ תפריט</label>
<div class="shell"><aside class="side"><div class="brand"><i>♪</i>מערכת התיווך</div><nav>${links}</nav>
<div class="grp">קישורים</div><nav><a href="/" target="_blank">${icon("home")}האתר הציבורי</a></nav></aside>
<main class="main"><div class="top"><div><h1>${esc(title)}</h1></div><div class="sp"></div></div>${body}</main></div>
<script>${JS}</script></body></html>`;
}

export function publicPage(title: string, body: string): string {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title || "מערכת תיווך לאורגניסטים וזמרים")}</title>
<style>${CSS}</style></head><body>
<div class="pub-top"><div><i>♪</i>מערכת תיווך לאורגניסטים וזמרים</div></div>
<div class="pub-main">${title ? `<h1 style="margin-bottom:14px">${esc(title)}</h1>` : ""}${body}</div>
<script>${JS}</script></body></html>`;
}

// ───────────── טבלאות וכפתורים ─────────────

type Col = [string, string, ((r: Row) => string)?];
export function table(cols: Col[], rows: Row[], extra?: (r: Row) => string, id = "tbl"): string {
  if (!rows.length) return `<div class="card empty-state">אין נתונים להצגה.</div>`;
  return `<div class="tablewrap"><table id="${id}"><thead><tr>${cols.map(([, h]) => `<th>${h}</th>`).join("")}${extra ? "<th></th>" : ""}</tr></thead><tbody>${rows
    .map((r) => `<tr>${cols.map(([k, , f]) => `<td>${f ? f(r) : esc(typeof r[k] === "object" && r[k] !== null ? JSON.stringify(r[k]) : r[k])}</td>`).join("")}${extra ? `<td><div class="acts">${extra(r)}</div></td>` : ""}</tr>`)
    .join("")}</tbody></table></div>`;
}

export const delBtn = (table: string, id: string) =>
  `<form method="post" action="/admin/delete" class="inline" onsubmit="return confirm('למחוק? אי אפשר לשחזר.')"><input type="hidden" name="table" value="${table}"><input type="hidden" name="id" value="${id}"><button class="d sm">מחיקה</button></form>`;

export const filterBox = (tableId: string, placeholder = "חיפוש מהיר בטבלה...") =>
  `<input type="search" data-filter="#${tableId}" placeholder="${placeholder}" style="max-width:340px">`;

// ───────────── רכיבי טפסים ─────────────

export const fld = (label: string, control: string, hint = "") =>
  `<div class="fld"><label>${label}</label>${control}${hint ? `<div class="hint">${hint}</div>` : ""}</div>`;
export const text = (name: string, v: any = "", extra = "") => `<input type="text" name="${name}" value="${esc(v)}" ${extra}>`;
export const tel = (name: string, v: any = "", extra = "") => `<input type="tel" name="${name}" value="${esc(v)}" inputmode="tel" dir="ltr" placeholder="05X-XXXXXXX" ${extra}>`;
export const area = (name: string, v: any = "", extra = "") => `<textarea name="${name}" ${extra}>${esc(v)}</textarea>`;
export const dateField = (name: string, v: any = "", required = false) => `<input type="date" name="${name}" value="${esc(v)}" data-heb ${required ? "required" : ""}>`;
export const sec = (title: string, ic: string, body: string) => `<div class="sec"><h3>${icon(ic)}${title}</h3>${body}</div>`;

export function segmented(name: string, options: [string, string, string?][], cur: any, cards = false): string {
  return `<div class="seg${cards ? " cards" : ""}">${options
    .map(([v, l, sub]) => `<label><input type="radio" name="${name}" value="${esc(v)}"${String(cur ?? "") === v ? " checked" : ""}><span>${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ""}</span></label>`)
    .join("")}</div>`;
}

export function dayPills(name: string, selected: number[] = []): string {
  return `<div class="pills" data-min-checked="1">${DAY_FULL.map((d, i) => `<label><input type="checkbox" name="${name}" value="${i + 1}"${selected.includes(i + 1) ? " checked" : ""}><span>${d}</span></label>`).join("")}</div>
<div class="err">יש לבחור לפחות יום אחד</div>`;
}

export function switchBox(name: string, label: string, on: boolean): string {
  return `<label class="switch"><input type="checkbox" name="${name}" value="1"${on ? " checked" : ""}><span>${label}</span></label>`;
}

/** בורר שעה: שני תפריטי בחירה (שעה, דקות) — עובד גם בלי JavaScript */
export function timeSelect(name: string, value = ""): string {
  const v = value.replace(":", "").padStart(value ? 4 : 0, "0");
  const H = v.slice(0, 2), M = v.slice(2, 4);
  const hours = ["", ...Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))];
  const mins = new Set(["", ...Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))]);
  if (M) mins.add(M);
  const opt = (list: string[], cur: string) => list.map((x) => `<option value="${x}"${x === cur ? " selected" : ""}>${x || "--"}</option>`).join("");
  return `<span class="ts"><select name="${name}_h" aria-label="שעה">${opt(hours, H)}</select><b>:</b><select name="${name}_m" aria-label="דקות">${opt([...mins].sort(), M)}</select></span>`;
}

/** קריאת שעה מטופס: name_h + name_m, או name בפורמט HH:MM. מחזיר HHMM או "" */
export function readTime(f: Row, name: string): string {
  const legacy = f[name];
  if (typeof legacy === "string" && legacy) return legacy.replace(":", "").padStart(4, "0").slice(0, 4);
  const h = f[`${name}_h`], m = f[`${name}_m`];
  if (h === undefined || h === "" || m === undefined || m === "") return "";
  return `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
}

export function windowsEditor(hours: Row[] = [], name = "w"): string {
  const rows = [0, 1, 2].map((i) => {
    const h = hours[i];
    const hide = i > 0 && !h;
    return `<div class="win${hide ? " hide" : ""}"><span class="muted">מ־</span>${timeSelect(`${name}s${i}`, h?.start || "")}<span class="to">עד</span>${timeSelect(`${name}e${i}`, h?.end || "")}</div>`;
  }).join("");
  return `<div data-need-window>${rows}</div><div class="err">יש למלא לפחות חלון שעות אחד</div>
<div class="chips"><button type="button" class="chip" data-preset="08:00-14:00">בוקר <bdi dir="ltr">08:00–14:00</bdi></button><button type="button" class="chip" data-preset="14:00-19:00">אחה״צ <bdi dir="ltr">14:00–19:00</bdi></button><button type="button" class="chip" data-preset="18:00-23:00">ערב <bdi dir="ltr">18:00–23:00</bdi></button><button type="button" class="chip" data-preset="20:00-01:00">לילה <bdi dir="ltr">20:00–01:00</bdi></button><button type="button" class="chip" data-preset="08:00-23:55">כל היום</button></div>
<button type="button" class="ghost sm" data-addwin>+ חלון נוסף</button>`;
}

export function money(name: string, v: any = "", extra = ""): string {
  return `<div class="money"><button type="button" data-step="-50" aria-label="הפחת">−</button><input type="number" name="${name}" value="${esc(v)}" min="0" max="100000" step="10" inputmode="numeric" placeholder="0" ${extra}><em>₪</em><button type="button" data-step="50" aria-label="הוסף">+</button></div>`;
}

export function ratingInput(name: string, v: any = 3): string {
  const n = Math.round(Number(v) || 3);
  return `<div class="rate">${[5, 4, 3, 2, 1].map((i) => `<input type="radio" id="${name}${i}" name="${name}" value="${i}"${n === i ? " checked" : ""}><label for="${name}${i}" title="${i}">★</label>`).join("")}</div>`;
}

export function cityCombo(name: string, v: any = "", required = false): string {
  return `<input type="text" name="${name}" value="${esc(v)}" data-combo="cities" placeholder="הקלידו כדי לחפש עיר או ישוב" ${required ? "required" : ""}>`;
}
export function hoodCombo(name: string, cityField: string, v: any = ""): string {
  return `<input type="text" name="${name}" value="${esc(v)}" data-combo="hoods" data-city="${cityField}" placeholder="בחרו מהרשימה או הקלידו חופשי">`;
}
export function citiesData(names: string[]): string {
  const uniq = [...new Set(names)].sort((a, b) => a.localeCompare(b, "he"));
  return `<script>window.__CITIES__=${JSON.stringify(uniq).replace(/</g, "\\u003c")};</script>`;
}

export function wizard(action: string, steps: [string, string][], panels: string[], submitLabel: string, extraHidden = ""): string {
  return `<form method="post" action="${action}" class="wiz card" data-wizard novalidate>
<ol class="steps">${steps.map(([t]) => `<li>${t}</li>`).join("")}</ol><div class="bar"><i></i></div>
${panels.map((p, i) => `<div class="step on"><h2>${steps[i][1]}</h2>${p}</div>`).join("")}
${extraHidden}
<div class="nav2"><button type="button" class="ghost" data-back>→ הקודם</button><span class="sp"></span><button type="button" data-next>הבא ←</button><button data-submit>${submitLabel}</button></div></form>`;
}
