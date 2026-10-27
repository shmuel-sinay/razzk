import type { Row } from "./types";

export const esc = (v: any) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const NAV = [
  ["", "סקירה"], ["settings", "הגדרות והודעות"], ["pros", "בעלי מקצוע"], ["clients", "לקוחות"],
  ["requests", "בקשות"], ["matches", "התאמות"], ["offers", "הצעות"], ["messages", "הודעות למנהלים"], ["partners", "שותפים"], ["cities", "ערים"],
];

export function page(title: string, body: string): string {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — ניהול</title>
<style>
body{font-family:system-ui,Arial,sans-serif;margin:0;background:#f5f6f8;color:#1c1e21}
nav{background:#1f3a5f;padding:10px 16px;display:flex;flex-wrap:wrap;gap:6px}
nav a{color:#fff;text-decoration:none;padding:6px 10px;border-radius:6px;font-size:15px}
nav a:hover{background:#2f5388}
main{max-width:1000px;margin:20px auto;padding:0 16px}
h1{font-size:22px} table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid #e4e6ea;text-align:right;font-size:14px;vertical-align:top}
th{background:#eef1f6}
input[type=text],textarea,select{width:100%;box-sizing:border-box;padding:7px;border:1px solid #c5cad3;border-radius:6px;font:inherit}
textarea{min-height:70px}
button{background:#1f3a5f;color:#fff;border:0;padding:8px 16px;border-radius:6px;font:inherit;cursor:pointer}
button.d{background:#b3261e} .card{background:#fff;padding:14px;border-radius:8px;margin-bottom:12px}
.k{display:inline-block;background:#fff;border-radius:8px;padding:14px 22px;margin:0 0 10px 10px;text-align:center}
.k b{display:block;font-size:26px} small{color:#666}
</style></head><body>
<nav>${NAV.map(([p, l]) => `<a href="/admin/${p}">${l}</a>`).join("")}</nav>
<main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}

export function table(cols: [string, string][], rows: Row[], extra?: (r: Row) => string): string {
  return `<table><tr>${cols.map(([, h]) => `<th>${h}</th>`).join("")}${extra ? "<th></th>" : ""}</tr>${rows
    .map((r) => `<tr>${cols.map(([k]) => `<td>${esc(typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k])}</td>`).join("")}${extra ? `<td>${extra(r)}</td>` : ""}</tr>`)
    .join("")}</table>`;
}

export const delBtn = (table: string, id: string) =>
  `<form method="post" action="/admin/delete" onsubmit="return confirm('למחוק?')"><input type="hidden" name="table" value="${table}"><input type="hidden" name="id" value="${id}"><button class="d">מחיקה</button></form>`;


/** עטיפת עמוד לדפים הציבוריים: בלי תפריט ניהול, ידידותי לנייד */
export function publicPage(title: string, body: string): string {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>
body{font-family:system-ui,Arial,sans-serif;margin:0;background:#f5f6f8;color:#1c1e21;line-height:1.5}
header{background:#1f3a5f;color:#fff;padding:14px 18px;font-size:19px}
main{max-width:640px;margin:18px auto;padding:0 14px 40px}
h1{font-size:22px} h3{margin:18px 0 6px}
.card{background:#fff;padding:16px;border-radius:10px;margin-bottom:14px;box-shadow:0 1px 3px #0001}
input[type=text],input[type=number],input[type=date],input[type=time],textarea,select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #c5cad3;border-radius:8px;font:inherit}
textarea{min-height:80px}
button,.btn{background:#1f3a5f;color:#fff;border:0;padding:11px 20px;border-radius:8px;font:inherit;cursor:pointer;text-decoration:none;display:inline-block}
.btn.big{display:block;text-align:center;padding:18px;font-size:19px;margin-bottom:12px}
.hp{position:absolute;left:-9999px;height:0;overflow:hidden}
.ok{background:#e6f4ea} .warn{background:#fff4e0} small{color:#666}
</style></head><body><header>מערכת תיווך לאורגניסטים וזמרים</header><main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}
