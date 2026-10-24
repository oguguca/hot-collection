// Mesma regra de backend/scripts/lib/wiki-parser.mjs (splitCollectionNumber).
// "120/365" -> { number: "120", total: 365 }. O número fica como texto ("008", "No #");
// só o formato exato número/número é separado, o resto fica como veio e sem total.
export function splitCollectionNumber(raw: string | null | undefined): {
  number: string | null;
  total: number | null;
} {
  if (raw == null) return { number: null, total: null };
  const text = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[​ ]/g, ' ')
    .trim();
  if (!text) return { number: null, total: null };

  const match = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return { number: text, total: null };

  const total = parseInt(match[2], 10);
  if (total < 1 || parseInt(match[1], 10) > total) return { number: text, total: null };
  return { number: match[1], total };
}
