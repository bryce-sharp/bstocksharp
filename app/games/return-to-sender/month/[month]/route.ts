import { MONTH_FILES } from "@/data/return-to-sender/months";
import type { MonthDays } from "@/components/games/return-to-sender/load";
import type { MonthFile } from "@/components/games/return-to-sender/schedule";

// A month's Return to Sender puzzles, but only the days already reached, so future regulations cannot be fetched
// early. The server's date runs a day ahead to cover every player's time zone; development serves every day.

function lastServableDay(): string {
  if (process.env.NODE_ENV !== "production") return "9999-12-31";
  const tomorrow = new Date(Date.now() + 86_400_000);
  return tomorrow.toISOString().slice(0, 10);
}

export async function GET(_request: Request, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const load = /^\d{4}-\d{2}$/.test(month) ? MONTH_FILES[month] : undefined;
  if (!load) return Response.json({ error: "No mail for that month." }, { status: 404 });

  const data = (await load()).default as MonthFile;
  const through = lastServableDay();
  const body: MonthDays = { monthKey: data.monthKey, version: data.version, through, days: data.days.filter((d) => d.dateKey <= through) };
  // Short caching: a new day becomes servable each day.
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=600" } });
}
