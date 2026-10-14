import { MONTH_FILES } from "@/data/snug/months";
import type { MonthFile } from "@/components/games/snug/outline";
import type { MonthDays } from "@/components/games/snug/puzzles";

// A month's Snug puzzles, but only the days already reached, so future quilts cannot be fetched early. The month's
// outline and size come only once every day is reached, so the shape stays a surprise until the month is done.
// The server's date runs a day ahead to cover every player's time zone; development serves every day for testing.

function lastServableDay(): string {
  if (process.env.NODE_ENV !== "production") return "9999-12-31";
  const tomorrow = new Date(Date.now() + 86_400_000);
  return tomorrow.toISOString().slice(0, 10);
}

export async function GET(_request: Request, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const load = /^\d{4}-\d{2}$/.test(month) ? MONTH_FILES[month] : undefined;
  if (!load) return Response.json({ error: "No quilt for that month." }, { status: 404 });

  const data = (await load()).default as MonthFile;
  const through = lastServableDay();
  const reached = data.days.filter((d) => d.dateKey <= through);
  const body: MonthDays = {
    monthKey: data.monthKey,
    version: data.version,
    through,
    days: reached.map((d) => ({ dateKey: d.dateKey, puzzle: d.puzzle, offset: d.offset })),
    shape: reached.length === data.days.length ? { outline: data.outline, minX: data.minX, minY: data.minY, width: data.width, height: data.height } : undefined,
  };
  // Short caching: a new day becomes servable each day.
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=600" } });
}
