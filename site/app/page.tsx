import { headers } from "next/headers";
import { getDB } from "@/lib/db";
import { recordPageview } from "@/lib/analytics";

import ScrollHero from "./components/ScrollHero";
import AboutSection from "./components/AboutSection";
import ServicesSection from "./components/ServicesSection";
import PortfolioSection from "./components/PortfolioSection";
import ProcessSection from "./components/ProcessSection";
import AwardsSection from "./components/AwardsSection";
import ReviewsSection from "./components/ReviewsSection";
import ContactSection from "./components/ContactSection";
import Footer from "./components/Footer";
import FloatingContactButton from "./components/FloatingContactButton";
import SectionTracker from "./components/SectionTracker";
import GoogleAnalytics from "./components/GoogleAnalytics";

export default async function Home() {
  const db = await getDB();
  const h = await headers();
  await recordPageview("/", h.get("referer"));

  const { services, portfolio, reviews, awards, processSteps, settings } = db.data;

  return (
    <main style={{ background: "#F4F1EA" }}>
      <GoogleAnalytics measurementId={settings.googleAnalyticsId} />

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
        <ServicesSection services={services} intro={settings.servicesIntro} label={settings.servicesLabel} />
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

      <Footer settings={settings} />
      <FloatingContactButton settings={settings} />
    </main>
  );
}
