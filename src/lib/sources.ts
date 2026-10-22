// Source priority: authoritative builder/RERA sources first, then portals.
// Higher score = trusted earlier in the merge.
export const SOURCE_PRIORITY: Array<{ pattern: RegExp; score: number; label: string }> = [
  { pattern: /rera\.up\.nic\.in/i, score: 100, label: "UP RERA" },
  { pattern: /haryanarera\.gov\.in/i, score: 100, label: "Haryana RERA" },
  { pattern: /rera\.delhi\.gov\.in/i, score: 100, label: "Delhi RERA" },
  { pattern: /rera\.rajasthan\.gov\.in/i, score: 100, label: "Rajasthan RERA" },
  { pattern: /\bdlf\.in\b/i, score: 90, label: "DLF" },
  { pattern: /godrejproperties\.com/i, score: 90, label: "Godrej" },
  { pattern: /m3mindia\.com/i, score: 90, label: "M3M" },
  { pattern: /tatahousing\.com/i, score: 90, label: "Tata Housing" },
  { pattern: /lodhagroup\.in/i, score: 90, label: "Lodha" },
  { pattern: /sobha\.com/i, score: 90, label: "Sobha" },
  { pattern: /signatureglobal\.in/i, score: 90, label: "Signature Global" },
  { pattern: /experion\.co/i, score: 90, label: "Experion" },
  { pattern: /atsgreens\.com/i, score: 90, label: "ATS" },
  { pattern: /\b99acres\.com\b/i, score: 60, label: "99acres" },
  { pattern: /\bmagicbricks\.com\b/i, score: 60, label: "MagicBricks" },
  { pattern: /\bhousing\.com\b/i, score: 60, label: "Housing.com" },
  { pattern: /\bsquareyards\.com\b/i, score: 55, label: "Square Yards" },
  { pattern: /\bproptiger\.com\b/i, score: 55, label: "PropTiger" },
  { pattern: /\bnobroker\.in\b/i, score: 50, label: "NoBroker" },
  { pattern: /\bcommonfloor\.com\b/i, score: 45, label: "CommonFloor" },
  { pattern: /\bnestaway\.com\b/i, score: 40, label: "Nestaway" },
];

export function scoreUrl(url: string): { score: number; label: string } {
  for (const { pattern, score, label } of SOURCE_PRIORITY) {
    if (pattern.test(url)) return { score, label };
  }
  return { score: 10, label: domainOf(url) };
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const NCR_CITIES = ["Gurugram", "Gurgaon", "Noida", "Greater Noida", "Delhi", "New Delhi", "Faridabad", "Ghaziabad"];
