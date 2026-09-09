import Link from "next/link";
import StatusPage from "./components/StatusPage";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="This page doesn't exist."
      body="The address may have changed, or the link that brought you here may be out of date. The studio's work and contact details are all on the main site."
    >
      <Link href="/" className="hi-cta">
        Return home
      </Link>
      <Link href="/#contact" className="hi-cta-outline">
        Contact the studio
      </Link>
    </StatusPage>
  );
}
