import Avatar from "@mui/material/Avatar";

/** A merchant's bank-feed logo, or its first letter when there is none or it fails to load. */
export default function MerchantAvatar({ logo, merchant, size }: { logo: string | null; merchant: string | null; size: number }) {
  return (
    <Avatar
      src={logo ?? undefined}
      alt=""
      slotProps={{ img: { loading: "lazy", referrerPolicy: "no-referrer" } }}
      sx={{ width: size, height: size, flex: "none", fontSize: size * 0.45, bgcolor: "action.selected", color: "text.primary" }}
    >
      {(merchant ?? "?").charAt(0).toUpperCase()}
    </Avatar>
  );
}
