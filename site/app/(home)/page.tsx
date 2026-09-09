import { headers } from "next/headers";
import {
  listAwards,
  listApprovedReviews,
  listProcessSteps,
  listProjects,
  listServices,
} from "@/lib/repos/content";
import { getSettings } from "@/lib/repos/settings";
import { recordPageview } from "@/lib/repos/analytics";
import { clientIp } from "@/lib/request";

import ScrollHero from "@/app/components/ScrollHero";
import AboutSection from "@/app/components/AboutSection";
import ServicesSection from "@/app/components/ServicesSection";
import PortfolioSection from "@/app/components/PortfolioSection";
import ProcessSection from "@/app/components/ProcessSection";
import AwardsSection from "@/app/components/AwardsSection";
import ReviewsSection from "@/app/components/ReviewsSection";
import ContactSection from "@/app/components/ContactSection";
import Footer from "@/app/components/Footer";
import FloatingContactButton from "@/app/components/FloatingContactButton";
import SectionTracker from "@/app/components/SectionTracker";
import GoogleAnalytics from "@/app/components/GoogleAnalytics";
import SiteHeader from "@/app/components/SiteHeader";
import StructuredData from "@/app/components/StructuredData";

export default async function Home() {
  const h = await headers();

  // Six independent reads — issued together rather than awaited in sequence.
  const [services, portfolio, reviews, awards, processSteps, settings] = await Promise.all([
    listServices(),
    listProjects(),
    listApprovedReviews(),
    listAwards(),
    listProcessSteps(),
    getSettings(),
  ]);

  // An append, not a read-modify-write of the whole store (finding C5).
  await recordPageview({
    path: "/",
    referrer: h.get("referer"),
    ip: clientIp(h),
    userAgent: h.get("user-agent") ?? "",
  });

  return (
    <>
      {/* First tab stop on the page: without it a keyboard user has to
          traverse the entire 500vh hero to reach any content. */}
      <a href="#main-content" className="hi-skip-link">
        Skip to content
      </a>

      <SiteHeader siteName={settings.siteName} />

      <main id="main-content" style={{ background: "var(--hi-surface)" }}>
        <GoogleAnalytics measurementId={settings.googleAnalyticsId} />
        <StructuredData settings={settings} projects={portfolio} reviews={reviews} />

        <ScrollHero
          heroLabel={settings.heroLabel}
          heroTitle={settings.heroTitle}
          heroParagraph={settings.heroParagraph}
          heroCta={settings.heroCta}
          philosophyLabel={settings.heroPhilosophyLabel}
          philosophyText={settings.heroPhilosophyText}
          processLabel={settings.heroProcessLabel}
          processText={settings.heroProcessText}
          closingLabel={settings.heroClosingLabel}
          closingTitle={settings.heroClosingTitle}
          closingCta={settings.heroClosingCta}
        />

        <SectionTracker name="about">
          <AboutSection settings={settings} />
        </SectionTracker>

        <SectionTracker name="services">
          <ServicesSection
            services={services}
            intro={settings.servicesIntro}
            label={settings.servicesLabel}
          />
        </SectionTracker>

        <SectionTracker name="portfolio">
          <PortfolioSection projects={portfolio} label={settings.portfolioLabel} />
        </SectionTracker>

        <SectionTracker name="process">
          <ProcessSection steps={processSteps} label={settings.processSectionLabel} />
        </SectionTracker>

        <SectionTracker name="recognition">
          <AwardsSection items={awards} label={settings.recognitionLabel} />
        </SectionTracker>

        <SectionTracker name="reviews">
          <ReviewsSection reviews={reviews} label={settings.reviewsLabel} />
        </SectionTracker>

        <SectionTracker name="contact">
          <ContactSection settings={settings} />
        </SectionTracker>
      </main>

      <Footer settings={settings} />
      <FloatingContactButton settings={settings} />
    </>
  );
}
