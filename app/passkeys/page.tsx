import { redirect } from "next/navigation";

// Passkeys (and your password) live on the account page.
export default function PasskeysPage() {
  redirect("/account");
}
