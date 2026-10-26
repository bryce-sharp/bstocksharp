import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { turnstileSiteKey } from "@/lib/signup";
import SignUpForm from "./SignUpForm";

export const metadata: Metadata = { title: "Create an account" };

// Public (proxy.ts): a games account for anyone, so their games save to every device.
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  if ((await getSession()) !== null) redirect("/");
  const { from } = await searchParams;
  return <SignUpForm from={from ?? ""} siteKey={turnstileSiteKey()} />;
}
