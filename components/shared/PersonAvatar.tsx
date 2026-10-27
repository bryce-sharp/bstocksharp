import Avatar from "@mui/material/Avatar";

/** "Bryce" → "B", "Bryce Stock" → "BS". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A person's colored initials. */
export default function PersonAvatar({
  person,
  size = 26,
}: {
  person: { name: string; color: string | null };
  size?: number;
}) {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        fontWeight: 700,
        bgcolor: person.color ?? "primary.main",
        color: "#fff",
      }}
    >
      {initials(person.name)}
    </Avatar>
  );
}
