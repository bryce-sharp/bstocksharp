// Showing a recipe at another size and in the cook's own units (docs/recipes/plan.md, "Scaling and units"). Lines
// stay as written unless scaled or converted; conversions stay within a kind, except cups of a few baking
// ingredients, which become grams marked "about". Pure.

export type UnitSystem = "written" | "us" | "metric";

export const UNIT_SYSTEMS: readonly { value: UnitSystem; label: string }[] = [
  { value: "written", label: "As written" },
  { value: "us", label: "US" },
  { value: "metric", label: "Metric" },
];

export function isUnitSystem(v: unknown): v is UnitSystem {
  return UNIT_SYSTEMS.some((u) => u.value === v);
}

// Amounts.

const VULGAR: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };
const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])`;
const RANGE = String.raw`(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?`;

function toNumber(s: string): number {
  const t = s.trim();
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const vulgar = /^(\d+(?:\.\d+)?)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/.exec(t);
  if (vulgar) return Number(vulgar[1] ?? 0) + VULGAR[vulgar[2]!]!;
  return Number(t);
}

const NICE: [number, string][] = [
  [0, ""],
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [1 / 2, "1/2"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [1, ""],
];

/** The value a cook's amount stands for, and how it is written: whole numbers with common fractions, else one decimal. */
function cookAmount(n: number): [value: number, text: string] {
  if (n >= 20) return [Math.round(n), String(Math.round(n))];
  const whole = Math.floor(n);
  const part = n - whole;
  const [value, text] = NICE.reduce((a, b) => (Math.abs(b[0] - part) < Math.abs(a[0] - part) ? b : a));
  if (Math.abs(value - part) > 0.04) return [Math.round(n * 10) / 10, String(Math.round(n * 10) / 10)];
  if (value === 1) return [whole + 1, String(whole + 1)];
  if (!text) return [whole, String(whole)];
  return [whole + value, whole ? `${whole} ${text}` : text];
}

/** A cook's way to write an amount: whole numbers with common fractions, else one decimal place. */
export function formatAmount(n: number): string {
  return cookAmount(n)[1];
}

/** A metric amount rounded the way a scale or jug reads; liters and kilograms keep two places. */
function metricAmount(n: number, large: boolean): string {
  const step = large ? (n < 10 ? 0.05 : 0.5) : n < 10 ? 0.5 : n < 50 ? 1 : n < 250 ? 5 : 10;
  return String(Math.round(Math.round(n / step) * step * 100) / 100);
}

/** The whole number or common fraction within `tolerance` of `n`, or null. */
function nearFraction(n: number, tolerance: number): number | null {
  const whole = Math.floor(n);
  const value = n >= 20 ? Math.round(n) : NICE.map(([f]) => whole + f).reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
  return value > 0 && Math.abs(value - n) <= n * tolerance ? value : null;
}

// Units. Volumes are in milliliters, weights in grams.

type UnitKey = "tsp" | "tbsp" | "cup" | "floz" | "pint" | "quart" | "gallon" | "stick" | "ml" | "l" | "oz" | "lb" | "g" | "kg";
type Unit = { kind: "volume" | "weight"; size: number; system: "us" | "metric" | "spoon"; names: [string, string]; min: number };

const UNIT: Record<UnitKey, Unit> = {
  tsp: { kind: "volume", size: 4.929, system: "spoon", names: ["tsp", "tsp"], min: 0 },
  tbsp: { kind: "volume", size: 14.787, system: "spoon", names: ["tbsp", "tbsp"], min: 1 },
  cup: { kind: "volume", size: 236.59, system: "us", names: ["cup", "cups"], min: 1 / 4 },
  floz: { kind: "volume", size: 29.574, system: "us", names: ["fl oz", "fl oz"], min: 0 },
  pint: { kind: "volume", size: 473.18, system: "us", names: ["pint", "pints"], min: 1 },
  quart: { kind: "volume", size: 946.35, system: "us", names: ["quart", "quarts"], min: 1 },
  gallon: { kind: "volume", size: 3785.4, system: "us", names: ["gallon", "gallons"], min: 1 },
  stick: { kind: "volume", size: 118.29, system: "us", names: ["stick", "sticks"], min: 0 },
  ml: { kind: "volume", size: 1, system: "metric", names: ["ml", "ml"], min: 0 },
  l: { kind: "volume", size: 1000, system: "metric", names: ["l", "l"], min: 1 },
  oz: { kind: "weight", size: 28.35, system: "us", names: ["oz", "oz"], min: 0 },
  lb: { kind: "weight", size: 453.59, system: "us", names: ["lb", "lb"], min: 1 },
  g: { kind: "weight", size: 1, system: "metric", names: ["g", "g"], min: 0 },
  kg: { kind: "weight", size: 1000, system: "metric", names: ["kg", "kg"], min: 1 },
};

// The units each system steps between when an amount grows or shrinks, smallest first. Metric cooks measure
// spoons below a quarter cup, and milliliters above.
const LADDER: Record<"us" | "metric", Record<Unit["kind"], UnitKey[]>> = {
  us: { volume: ["tsp", "tbsp", "cup"], weight: ["oz", "lb"] },
  metric: { volume: ["tsp", "tbsp", "ml", "l"], weight: ["g", "kg"] },
};
const QUARTER_CUP = 59;
// How far a smaller unit may count before the larger one reads better: 6 tsp, 8 tbsp.
const SMALLER_MAX: Partial<Record<UnitKey, number>> = { tsp: 6, tbsp: 8 };

/** Whether an amount prints as a whole number or common fraction. */
function clean(n: number): boolean {
  return !cookAmount(n)[1].includes(".");
}

// Spelled-out names, so a scaled "1 teaspoon" reads "2 teaspoons".
const LONG = /^(cup|teaspoon|tablespoon|ounce|pound|gram|kilogram|milliliter|millilitre|liter|litre|pint|quart|gallon|stick)s?$/i;

const UNIT_TOKEN = String.raw`fl\.?\s*oz|fluid\s+ounces?|teaspoons?|tsps?|tablespoons?|tbsps?|tbs|tb|cups?|ounces?|oz|pounds?|lbs?|grams?|gr|g|kilograms?|kgs?|milliliters?|millilitres?|mls?|liters?|litres?|l|pints?|pts?|quarts?|qts?|gallons?|gal|sticks?|t|c`;
const LEAD = new RegExp(String.raw`^(\s*${RANGE})(?:\s*(${UNIT_TOKEN})\.?(?![a-z]))?`, "i");
// The second part of "1 1/2 cups plus 1 Tbsp.".
const PLUS = new RegExp(String.raw`^\s*(?:plus|\+|and)\s+(${NUMBER})\s*(${UNIT_TOKEN})\.?(?![a-z])`, "i");
const PAREN = /^\s*\(([^()]*)\)/;
// "113 g", "113-152 g" or "113g to 152g".
const PAREN_ITEM = new RegExp(String.raw`(${NUMBER})(?:\s*(?:${UNIT_TOKEN})\.?(?![a-z]))?(?:\s*(?:-|–|to)\s*(${NUMBER}))?\s*(${UNIT_TOKEN})\.?(?![a-z])`, "gi");

function unitOf(token: string): UnitKey {
  const t = token.toLowerCase().replace(/\.|\s+/g, "");
  if (token === "T" || /^(tablespoons?|tbsps?|tbs|tb)$/.test(t)) return "tbsp";
  if (/^(t|teaspoons?|tsps?)$/.test(t)) return "tsp";
  if (/^(c|cups?)$/.test(t)) return "cup";
  if (/^(floz|fluidounces?)$/.test(t)) return "floz";
  if (/^(ounces?|oz)$/.test(t)) return "oz";
  if (/^(pounds?|lbs?)$/.test(t)) return "lb";
  if (/^(grams?|gr|g)$/.test(t)) return "g";
  if (/^(kilograms?|kgs?)$/.test(t)) return "kg";
  if (/^(milliliters?|millilitres?|mls?)$/.test(t)) return "ml";
  if (/^(liters?|litres?|l)$/.test(t)) return "l";
  if (/^(pints?|pts?)$/.test(t)) return "pint";
  if (/^(quarts?|qts?)$/.test(t)) return "quart";
  if (/^(gallons?|gal)$/.test(t)) return "gallon";
  return "stick";
}

/** Whether a unit is at home in a system: spoons are at home in both. */
function fits(key: UnitKey, system: "us" | "metric"): boolean {
  return UNIT[key].system === "spoon" || UNIT[key].system === system;
}

// Grams per US cup for the baking staples (King Arthur's ingredient weight chart, rounded).
const DENSITY: [RegExp, number][] = [
  [/\b(almond|coconut|chickpea|rice|oat|rye|tapioca|cassava|buckwheat|corn|spelt|semolina)\s+flour\b/i, 0],
  [/\bbread flour\b/i, 130],
  [/\bwhole[- ]wheat flour\b/i, 120],
  [/\bcake flour\b/i, 115],
  [/\bflour\b/i, 125],
  [/\b(powdered|confectioners'?|icing) sugar\b/i, 120],
  [/\bbrown sugar\b/i, 213],
  [/\bsugar\b/i, 200],
  [/\b(peanut|almond|apple|nut|cashew|sunflower) butter\b|\bbutter(milk|nut|scotch)\b/i, 0],
  [/\bbutter\b/i, 227],
  [/\bcocoa\b/i, 85],
  [/\b(kosher|flaky|sea|smoked) salt\b/i, 0],
  [/\bsalt\b/i, 288],
  [/\boats\b/i, 90],
  [/\bcooked rice\b/i, 0],
  [/\brice\b/i, 185],
];

function gramsPerCup(name: string): number {
  return DENSITY.find(([re]) => re.test(name))?.[1] ?? 0;
}

type Pick = { key: UnitKey; per: number; snap: boolean };

/**
 * The unit an amount (in milliliters or grams) reads best in: the largest where it is a common fraction, else the
 * largest it reaches. `loose` allows a conversion's few percent ("250 ml" is "1 cup"), so its amount snaps.
 */
function inLadder(base: number, kind: Unit["kind"], system: "us" | "metric", loose: boolean): Pick {
  const spoons = system === "metric" && kind === "volume" && base < QUARTER_CUP;
  const ladder = LADDER[system][kind].filter((k) => kind !== "volume" || system !== "metric" || (UNIT[k].system === "spoon") === spoons);
  const largestFirst = [...ladder].reverse();
  const reached = largestFirst.find((k) => base / UNIT[k].size >= UNIT[k].min) ?? ladder[0]!;
  const nice = largestFirst.find((k) => {
    const n = base / UNIT[k].size;
    if (n < UNIT[k].min || (k !== reached && n > (SMALLER_MAX[k] ?? Infinity))) return false;
    return UNIT[k].system === "metric" || (loose || UNIT[k].system === "spoon" ? nearFraction(n, 0.06) !== null : clean(n));
  });
  const key = nice ?? reached;
  // Conversions and spoons snap to the nearest common fraction: no one measures 1.8 teaspoons.
  return { key, per: UNIT[key].size, snap: nice !== null && (loose || UNIT[key].system === "spoon") && UNIT[key].system !== "metric" };
}

function amountText(n: number, key: UnitKey, snap = false): string {
  if (UNIT[key].system === "metric") return metricAmount(n, UNIT[key].size === 1000);
  return formatAmount(snap ? (nearFraction(n, 0.06) ?? n) : n);
}

function unitName(key: UnitKey, amount: number, written?: string): string {
  if (written && LONG.test(written)) return written.replace(/s$/i, "") + (amount > 1 ? "s" : "");
  if (written) return written;
  return UNIT[key].names[amount > 1 ? 1 : 0];
}

/** An awkward cup amount the way a cook measures it: "3/4 cup plus 1 tbsp". */
function cupsPlusSpoons(cups: number): string | null {
  const whole = Math.floor(cups);
  const part = NICE.map(([f]) => f).filter((f) => f < 1 && f <= cups - whole + 1e-9).pop() ?? 0;
  const spoons = Math.round((cups - whole - part) * 16 * 2) / 2;
  if (whole + part === 0 || spoons < 0.5 || spoons >= 4) return null;
  const c = whole + part;
  return `${formatAmount(c)} ${c > 1 ? "cups" : "cup"} plus ${formatAmount(spoons)} tbsp`;
}

type Lead = { low: number; high?: number; key: UnitKey; token: string; raw: string };
type Head = { amount: string; unit: string; about: boolean };

function head(low: number, high: number | undefined, pick: Pick | UnitKey, written?: string): Head {
  const { key, per, snap } = typeof pick === "string" ? { key: pick, per: UNIT[pick].size, snap: false } : pick;
  const [a, b] = [low / per, high === undefined ? undefined : high / per];
  const top = snap ? (nearFraction(b ?? a, 0.06) ?? b ?? a) : (b ?? a);
  if (key === "cup" && b === undefined && !snap && !clean(a)) {
    const plus = cupsPlusSpoons(a);
    if (plus) return { amount: plus, unit: "", about: false };
  }
  return { amount: b === undefined ? amountText(a, key, snap) : `${amountText(a, key, snap)} to ${amountText(b, key, snap)}`, unit: unitName(key, top, written), about: false };
}

/** The amount and unit as they should read in `system`, or null when the line can stay exactly as written. */
function shownHead(lead: Lead, factor: number, system: UnitSystem, name: string): Head | null {
  const { key, token } = lead;
  const u = UNIT[key];
  const low = lead.low * factor * u.size;
  const high = lead.high === undefined ? undefined : lead.high * factor * u.size;
  const home = u.system === "metric" ? "metric" : "us";
  const target = system === "written" ? home : system;
  // Grams of a baking staple stay grams in US: a dough weighed out should not turn into cups.
  const staysWeighed = system === "us" && u.system === "metric" && u.kind === "weight" && gramsPerCup(name) > 0;

  // In Metric, a quarter cup or more of a baking staple is weighed, from whatever spoon or cup it was written in.
  const grams = target === "metric" && u.kind === "volume" && low >= QUARTER_CUP ? gramsPerCup(name) : 0;
  if (grams) {
    const toGrams = (ml: number) => (ml / UNIT.cup.size) * grams;
    const weight = toGrams(low);
    const heaviest = toGrams(high ?? low);
    return { ...head(weight, high === undefined ? undefined : toGrams(high), inLadder(heaviest, "weight", "metric", true)), about: true };
  }

  if (fits(key, target) || staysWeighed) {
    if (factor === 1) return null;
    const ladderSystem = staysWeighed ? "metric" : target;
    // Units off the ladder (sticks, quarts) just scale; ladder units step to the one that reads best.
    if (!LADDER[ladderSystem][u.kind].includes(key)) return head(low, high, key, token);
    // A range takes the unit its larger end reads best in.
    const pick = inLadder(high ?? low, u.kind, ladderSystem, false);
    return head(low, high, pick, pick.key === key ? token : undefined);
  }
  return head(low, high, inLadder(high ?? low, u.kind, target, true));
}

/** A written amount or range; "1-3/4" is one and three quarters, not a range running down. */
function amountOf(low: string, high: string | undefined): { low: number; high?: number } {
  const a = toNumber(low);
  if (high === undefined) return { low: a };
  const b = toNumber(high);
  return b < a && b < 1 && Number.isInteger(a) ? { low: a + b } : { low: a, high: b };
}

function scaledAmount(low: string, high: string | undefined, factor: number): string {
  const r = amountOf(low, high);
  return r.high === undefined ? formatAmount(r.low * factor) : `${formatAmount(r.low * factor)} to ${formatAmount(r.high * factor)}`;
}

/** The amounts in a parenthesis after a unit ("(115 g)", "(1 stick, 113 g)"), or null when it holds anything else. */
function parenAmounts(inner: string): Lead[] | null {
  const items: Lead[] = [];
  const left = inner.replace(PAREN_ITEM, (raw: string, low: string, high: string | undefined, token: string) => {
    items.push({ ...amountOf(low, high), key: unitOf(token), token, raw });
    return "";
  });
  return items.length && /^[\s,/;+]*(?:(?:or|about|approx\.?)[\s,/;+]*)*$/i.test(left) ? items : null;
}

function headText(lead: Lead, factor: number, system: UnitSystem, name: string): string {
  const out = shownHead(lead, factor, system, name);
  return out ? `${out.about ? "about " : ""}${out.amount}${out.unit ? ` ${out.unit}` : ""}` : lead.raw;
}

/**
 * The ingredient line multiplied by `factor` and shown in `system`. Counts ("2 eggs") scale; a package size after a
 * count ("1 can (14 oz)") stays as it is; a line that gives both units ("1 cup (200 g) sugar") uses the right one.
 */
export function showIngredient(line: string, factor: number, system: UnitSystem): string {
  if (system === "written" && factor === 1) return line;
  const m = LEAD.exec(line);
  if (!m) return showTemperatures(line, system);
  const [, number, low, high, token] = m;
  let rest = line.slice(m[0].length);
  // A stick is butter's; "4 sticks of celery" is a count.
  if (!token || (unitOf(token) === "stick" && !/butter|margarine/i.test(rest))) return showTemperatures(scaledAmount(low!, high, factor) + line.slice(number!.length), system);

  const lead: Lead = { ...amountOf(low!, high), key: unitOf(token), token, raw: "" };
  const plus = PLUS.exec(rest);
  const extra: Lead | null = plus && UNIT[unitOf(plus[2]!)].kind === UNIT[lead.key].kind ? { low: toNumber(plus[1]!), key: unitOf(plus[2]!), token: plus[2]!, raw: "" } : null;
  if (plus && extra) rest = rest.slice(plus[0].length);
  lead.raw = line.slice(0, line.length - rest.length).trim();
  const paren = PAREN.exec(rest);
  const items = paren ? parenAmounts(paren[1]!) : null;
  if (paren && items) rest = rest.slice(paren[0].length);

  let text: string;
  // A chosen system uses the line's own amount in that system when it gives one, and drops the other.
  const own = system === "written" ? undefined : items?.find((l) => UNIT[l.key].system === system);
  if (own && UNIT[lead.key].system !== system) text = headText(own, factor, system, rest);
  else if (extra && (system === "written" || fits(lead.key, system))) {
    // Each part scales in its own unit: "3 cups plus 2 Tbsp."; at its own size the line stays as written.
    text = factor === 1 ? lead.raw : [lead, extra].map((l) => headText({ ...l, high: undefined }, factor, system === "written" ? "written" : system, rest)).join(" plus ");
  } else {
    const size = UNIT[lead.key].size;
    const total = extra ? { ...lead, low: lead.low + (extra.low * UNIT[extra.key].size) / size, high: undefined } : lead;
    text = headText(total, factor, system, rest);
  }
  const other =
    system === "written" && paren && items ? ` (${paren[1]!.replace(new RegExp(PAREN_ITEM.source, "gi"), (_, a: string, b: string | undefined, t: string) => `${scaledAmount(a, b, factor)} ${unitName(unitOf(t), (amountOf(a, b).high ?? amountOf(a, b).low) * factor, t)}`)})` : "";
  return showTemperatures(text + other + rest, system);
}

const TEMPERATURE = /(\d{2,3})(?:\s*(?:-|–|to)\s*(\d{2,3}))?\s*(?:°\s*|º\s*|degrees?\s+)([FC])\b|(\d{2,3})(?:\s*(?:-|–|to)\s*(\d{2,3}))?\s*(℉|℃)|(\d{3})\s*([FC])\b(?![a-z])/g;

function convertTemperature(n: number, to: "F" | "C"): number {
  if (to === "C") {
    const c = ((n - 32) * 5) / 9;
    return Math.round(c / (c >= 100 ? 10 : 5)) * (c >= 100 ? 10 : 5);
  }
  const f = (n * 9) / 5 + 32;
  return Math.round(f / (f >= 200 ? 25 : 5)) * (f >= 200 ? 25 : 5);
}

/** Text with each temperature in the system's scale: 350°F reads 180°C in Metric, and 200°C reads 400°F in US. */
export function showTemperatures(text: string, system: UnitSystem): string {
  if (system === "written") return text;
  const to = system === "metric" ? "C" : "F";
  return text.replace(TEMPERATURE, (whole, a1?: string, b1?: string, s1?: string, a2?: string, b2?: string, s2?: string, a3?: string, s3?: string) => {
    const from = s1 ?? (s2 === "℉" ? "F" : s2 === "℃" ? "C" : s3);
    if (from?.toUpperCase() === to) return whole;
    const low = Number(a1 ?? a2 ?? a3);
    const high = b1 ?? b2;
    return `${convertTemperature(low, to)}${high ? `–${convertTemperature(Number(high), to)}` : ""}°${to}`;
  });
}
