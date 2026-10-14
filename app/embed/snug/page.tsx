import Box from "@mui/material/Box";
import { SnugGame } from "@/components/games/snug/SnugClient";
import { getGame } from "@/lib/games";

export const metadata = { title: getGame("snug")!.name };

/** The host page's own address, so shares point where the game was played. */
function shareUrl(raw: string | string[] | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

// Frameless Snug for other sites to embed: <iframe src="https://www.bstocksharp.dev/embed/snug?share=...">.
export default async function SnugEmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { share } = await searchParams;
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, md: 3 }, pt: { xs: 1, md: 2 }, pb: 2.5 }}>
      <SnugGame shareUrl={shareUrl(share)} />
    </Box>
  );
}
