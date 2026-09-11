import type { Metadata } from "next";
import { emailConfigured } from "@/lib/email";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

/**
 * Rendered per request, like the sign-in page, so its scripts carry the nonce
 * from the same request as the policy that checks them.
 */
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm available={emailConfigured()} />;
}
