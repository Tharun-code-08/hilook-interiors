import Script from "next/script";
import { headers } from "next/headers";

const VALID_ID = /^G-[A-Z0-9]+$/i;

/**
 * GA4, loaded with the request's CSP nonce.
 *
 * The init snippet is inline, and the policy in middleware.ts no longer allows
 * inline script without a nonce. Reading the nonce here rather than keeping
 * 'unsafe-inline' site-wide means this one known snippet is trusted instead of
 * every snippet an injection might manage to introduce.
 */
export default async function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const id = measurementId.trim();
  if (!VALID_ID.test(id)) return null;

  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}
