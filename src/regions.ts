import { normalize } from "./hebrew";

/** אזורי שירות: בעל מקצוע שבוחר אזור מקבל בקשות מכל הערים שבו. הרשימות ניתנות לתיקון כאן. */
export const REGIONS: Record<string, { label: string; cities: string[] }> = {
  gush_dan: {
    label: "גוש דן",
    cities: ["תל אביב יפו", "רמת גן", "גבעתיים", "בני ברק", "פתח תקווה", "חולון", "בת ים", "אור יהודה", "קרית אונו", "גבעת שמואל", "יהוד מונוסון", "רמת השרון", "אזור", "ראשון לציון"],
  },
  jerusalem: { label: "ירושלים והסביבה", cities: ["ירושלים", "בית שמש", "מבשרת ציון", "מעלה אדומים", "גבעת זאב", "ביתר עילית", "מבוא ביתר"] },
  center: { label: "מרכז ושפלה", cities: ["רחובות", "נס ציונה", "לוד", "רמלה", "יבנה", "גן יבנה", "מודיעין עילית", "מודיעין מכבים רעות", "אלעד", "ראש העין"] },
  sharon: { label: "שרון", cities: ["נתניה", "הרצליה", "רעננה", "כפר סבא", "הוד השרון", "רמת השרון"] },
  south: { label: "דרום", cities: ["אשדוד", "אשקלון", "קרית גת", "קרית מלאכי", "נתיבות", "אופקים", "באר שבע"] },
  north: { label: "צפון", cities: ["חיפה", "צפת", "טבריה", "קרית אתא", "נהריה", "עכו", "כרמיאל", "עפולה", "בית שאן"] },
};

const NORM = Object.fromEntries(
  Object.entries(REGIONS).map(([k, r]) => [k, new Set(r.cities.map(normalize))]),
);

export function cityInRegion(region: string | null | undefined, cityName: string | null | undefined): boolean {
  if (!region || !cityName || !NORM[region]) return false;
  return NORM[region].has(normalize(cityName));
}
