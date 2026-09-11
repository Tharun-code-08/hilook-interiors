import type { Metadata } from "next";
import { peekResetToken } from "@/lib/repos/password-resets";
import { findUserById } from "@/lib/repos/operations";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
  // The token is in this page's address; nothing it links to should be told.
  referrer: "no-referrer",
};

/** Per request: the nonce, and a link's validity, both belong to this request. */
export const dynamic = "force-dynamic";

/**
 * Where a reset link lands.
 *
 * The link is checked here but not used up — mail scanners open links before
 * people do. It is used up only when the new password is submitted.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";

  const valid = token ? await peekResetToken(token) : null;
  const user = valid ? await findUserById(valid.userId) : null;

  return (
    <ResetPasswordForm token={valid && user ? token : null} username={user?.username ?? null} />
  );
}
