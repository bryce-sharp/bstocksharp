import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import AddIcon from "@mui/icons-material/Add";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { listWishlist } from "@/lib/queries/wishlist";
import WishlistView from "@/components/garage/WishlistView";

export default async function WishlistSection({
  vehicleId,
  editor,
}: {
  vehicleId: number;
  editor: boolean;
}) {
  const items = await listWishlist(vehicleId);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h6">Dream parts</Typography>
        {editor ? (
          <Button
            component={Link}
            href={`/garage/${vehicleId}/wishlist/new`}
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
          >
            Add item
          </Button>
        ) : null}
      </Stack>

      {items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <FavoriteBorderIcon
            sx={{ fontSize: 40, color: "text.disabled", mb: 1 }}
          />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {editor
              ? "No wishlist items yet — add the parts you're dreaming about."
              : "No wishlist items yet."}
          </Typography>
        </Paper>
      ) : (
        <WishlistView items={items} vehicleId={vehicleId} editor={editor} />
      )}
    </Box>
  );
}
