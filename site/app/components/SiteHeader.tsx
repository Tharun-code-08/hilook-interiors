"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

/**
 * The public site had no navigation at all (finding H8) — no logo, no menu,
 * no mobile drawer. The only way to reach a section was to scroll past 500vh
 * of hero or find the link list in the footer.
 *
 * Transparent over the hero, solid once past it, with the active section
 * tracked by IntersectionObserver.
 */

const SECTIONS = [
  { id: "about", label: "About" },
  { id: "services", label: "Services" },
  // A real route, not a section anchor: /work is the crawlable index.
  { id: "portfolio", label: "Projects", href: "/work" },
  { id: "process", label: "Process" },
  { id: "reviews", label: "Reviews" },
] as const;

export default function SiteHeader({ siteName }: { siteName: string }) {
  const pathname = usePathname();
  const onHome = pathname === "/";

  // Bare "#about" only resolves on the home page; from /work/<slug> it would
  // look for a section that is not there. Off home, the anchors become
  // absolute so they navigate home and then scroll.
  const sectionHref = (section: { id: string; href?: string }) =>
    section.href ?? (onHome ? `#${section.id}` : `/#${section.id}`);

  // Inner pages have no hero behind the bar, so it starts solid there.
  const [solid, setSolid] = useState(!onHome);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Transparent while the hero is on screen, solid once past it.
  //
  // Keyed to the hero element itself rather than a scroll offset. The hero is
  // a 500vh scroll container with a sticky 100vh canvas, so footage sits
  // behind the header for the whole thing — an earlier version compared
  // scrollY against one viewport height and flipped the header to
  // cream-on-cream about a fifth of the way in, putting dark text over dark
  // footage. Doing the same with the hero's measured height then had its own
  // failure mode: if the element hadn't laid out when the effect ran, the
  // threshold came out negative and the header was solid from the start.
  //
  // An observer has neither problem: it reports what is actually on screen,
  // and re-evaluates on resize and reflow without any height arithmetic.
  useEffect(() => {
    if (!onHome) {
      setSolid(true);
      return;
    }

    const hero = document.querySelector<HTMLElement>("[data-hero]");

    // No hero on the page at all — treat everything as past it.
    if (!hero) {
      setSolid(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setSolid(!entry.isIntersecting),
      // Retract the top edge by the header's own height so the swap happens as
      // the hero's last pixels pass under the bar, not once it has fully gone.
      { rootMargin: "-68px 0px 0px 0px", threshold: 0 }
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, [onHome]);

  useEffect(() => {
    if (!onHome) return;

    const observed = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (observed.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The section occupying the most of the viewport wins, so a short
        // section sandwiched between two tall ones doesn't flicker the
        // highlight as it passes.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] }
    );

    observed.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [onHome]);

  // Escape closes the drawer, and focus is trapped inside it while open.
  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !menuRef.current) return;

      const focusable = menuRef.current.querySelectorAll<HTMLElement>("a, button");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const onDark = !solid;

  return (
    <>
      <header
        className="hi-header"
        data-solid={solid ? "true" : "false"}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 80,
          transition: "background 0.4s var(--hi-ease), box-shadow 0.4s var(--hi-ease)",
          background: solid ? "rgba(244,241,234,0.92)" : "transparent",
          backdropFilter: solid ? "saturate(140%) blur(12px)" : "none",
          boxShadow: solid ? "0 1px 0 var(--hi-rule)" : "none",
        }}
      >
        <div
          className="hi-container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1.5rem",
            height: 68,
          }}
        >
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "1.05rem",
              letterSpacing: "0.02em",
              textDecoration: "none",
              color: onDark ? "var(--hi-on-dark)" : "var(--hi-ink)",
              transition: "color 0.4s var(--hi-ease)",
              whiteSpace: "nowrap",
            }}
          >
            {siteName}
          </Link>

          <nav aria-label="Sections" className="hi-header-nav">
            <ul style={{ display: "flex", gap: "1.75rem", listStyle: "none", margin: 0 }}>
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <li key={section.id}>
                    <a
                      href={sectionHref(section)}
                      aria-current={isActive ? "true" : undefined}
                      style={{
                        fontFamily: "var(--font-inter), system-ui, sans-serif",
                        fontSize: "0.7rem",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        textDecoration: "none",
                        paddingBottom: 4,
                        borderBottom: `1px solid ${isActive ? "var(--hi-accent)" : "transparent"}`,
                        color: onDark
                          ? isActive
                            ? "var(--hi-accent-lift)"
                            : "rgba(248,242,232,0.82)"
                          : isActive
                            ? "var(--hi-accent-text)"
                            : "var(--hi-ink-muted)",
                        transition: "color 0.3s var(--hi-ease), border-color 0.3s var(--hi-ease)",
                      }}
                    >
                      {section.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <a
            href="#contact"
            className="hi-header-cta"
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "0.68rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              textDecoration: "none",
              padding: "0.6rem 1.3rem",
              minHeight: 40,
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 2,
              // --hi-accent here measured 2.86:1 against --hi-on-dark, which
              // fails AA. Text-bearing fills take --hi-accent-strong; the token
              // note in globals.css spells out the split.
              background: onDark ? "rgba(248,242,232,0.14)" : "var(--hi-accent-strong)",
              color: "var(--hi-on-dark)",
              border: onDark
                ? "1px solid rgba(248,242,232,0.34)"
                : "1px solid var(--hi-accent-strong)",
              transition: "background 0.3s var(--hi-ease), border-color 0.3s var(--hi-ease)",
              whiteSpace: "nowrap",
            }}
          >
            Enquire
          </a>

          <button
            ref={toggleRef}
            type="button"
            className="hi-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="hi-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
            style={{
              width: 44,
              height: 44,
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: onDark ? "var(--hi-on-dark)" : "var(--hi-ink)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="none">
              {menuOpen ? (
                <path
                  d="M4 4l14 14M18 4L4 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M3 6h16M3 11h16M3 16h16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          ref={menuRef}
          id="hi-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "var(--hi-surface-dark)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "2rem clamp(1.5rem, 8vw, 4rem)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              toggleRef.current?.focus();
            }}
            aria-label="Close menu"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 44,
              height: 44,
              background: "transparent",
              border: "none",
              color: "var(--hi-on-dark)",
              fontSize: "1.5rem",
            }}
          >
            ×
          </button>

          <nav aria-label="Sections">
            <ul style={{ listStyle: "none", display: "grid", gap: "0.5rem", margin: 0 }}>
              {[...SECTIONS, { id: "contact", label: "Contact" } as const].map((section) => (
                <li key={section.id}>
                  <a
                    href={sectionHref(section)}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: "block",
                      padding: "0.7rem 0",
                      fontFamily: "var(--font-playfair), Georgia, serif",
                      fontSize: "1.75rem",
                      color: "var(--hi-on-dark)",
                      textDecoration: "none",
                    }}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
