import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { getSettings } from "@/lib/repos/settings";
import { POSTER_FRAME_SRC } from "@/lib/hero-frames";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-playfair",
  display: "swap",
});

/**
 * Metadata was previously title + description only: no metadataBase, no
 * canonical, no Open Graph or Twitter card, so a shared link rendered as a
 * bare URL with no preview (finding H10).
 */
export async function generateMetadata(): Promise<Metadata> {
  const { siteName, metaDescription } = await getSettings();
  const base = siteUrl();

  return {
    metadataBase: new URL(base),
    title: {
      default: siteName,
      // Inner pages set their own title; this frames it.
      template: `%s · ${siteName}`,
    },
    description: metaDescription,
    applicationName: siteName,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName,
      title: siteName,
      description: metaDescription,
      url: base,
      locale: "en_US",
      images: [
        {
          // A real frame from the hero footage rather than a generated card —
          // it is the most representative image the site owns.
          url: POSTER_FRAME_SRC,
          width: 1920,
          height: 1080,
          alt: `${siteName} — interior design and architecture`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description: metaDescription,
      images: [POSTER_FRAME_SRC],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
  };
}

export const viewport = {
  themeColor: "#26231F",
  width: "device-width",
  initialScale: 1,
  // Not maximumScale: 1 — capping zoom is an accessibility failure.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
