import Script from "next/script";

const VALID_ID = /^G-[A-Z0-9]+$/i;

export default function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const id = measurementId.trim();
  if (!VALID_ID.test(id)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
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
