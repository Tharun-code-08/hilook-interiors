"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

/**
 * The image set on a project page.
 *
 * A grid that opens a full-bleed viewer. This is where the lightbox belongs
 * now: on the home page the portfolio cards became real links to these pages
 * (finding H9 — projects had no addresses to link to), so the quick-view
 * modal there was replaced by navigation, and the gallery moved here where
 * there is a full image set worth stepping through.
 *
 * Carries the accessibility work the home lightbox had: role="dialog",
 * aria-modal, a focus trap, Escape to close, arrow keys, and focus returned
 * to the thumbnail that opened it.
 */
export default function ProjectGallery({ images, title }: { images: string[]; title: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpenIndex(null);
    openerRef.current?.focus();
    openerRef.current = null;
  }, []);

  const showNext = useCallback(() => {
    setOpenIndex((i) => (i === null ? i : (i + 1) % images.length));
  }, [images.length]);

  const showPrev = useCallback(() => {
    setOpenIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
  }, [images.length]);

  useEffect(() => {
    if (openIndex === null) return;

    const dialog = dialogRef.current;
    dialog?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowRight" && images.length > 1) {
        event.preventDefault();
        showNext();
        return;
      }
      if (event.key === "ArrowLeft" && images.length > 1) {
        event.preventDefault();
        showPrev();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = dialog.querySelectorAll<HTMLElement>("button, [href]");
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
  }, [openIndex, close, showNext, showPrev, images.length]);

  if (images.length === 0) return null;

  return (
    <>
      <ul className="hi-gallery-grid">
        {images.map((src, i) => (
          <li key={`${src}-${i}`}>
            <button
              type="button"
              className="hi-gallery-item hi-focusable"
              aria-label={`View image ${i + 1} of ${images.length}, larger`}
              onClick={(e) => {
                openerRef.current = e.currentTarget;
                setOpenIndex(i);
              }}
            >
              <Image
                src={src}
                alt={`${title} — image ${i + 1}`}
                fill
                sizes="(min-width: 1000px) 50vw, 100vw"
                // The first pair are usually above the fold on a project page.
                loading={i < 2 ? "eager" : "lazy"}
                style={{ objectFit: "cover" }}
              />
            </button>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {openIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={close}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(18,14,10,0.94)",
              zIndex: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "clamp(1rem, 4vw, 3rem)",
            }}
          >
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={`${title}, image ${openIndex + 1} of ${images.length}`}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 1200,
                aspectRatio: "3 / 2",
                outline: "none",
              }}
            >
              <Image
                src={images[openIndex]}
                alt={`${title} — image ${openIndex + 1}`}
                fill
                sizes="(min-width: 1200px) 1200px, 100vw"
                priority
                style={{ objectFit: "contain" }}
              />

              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="hi-lightbox-btn hi-focusable"
                style={{ top: -8, right: -8, position: "absolute" }}
              >
                ×
              </button>

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={showPrev}
                    aria-label="Previous image"
                    className="hi-lightbox-btn hi-focusable"
                    style={{ left: -8, top: "50%", position: "absolute" }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={showNext}
                    aria-label="Next image"
                    className="hi-lightbox-btn hi-focusable"
                    style={{ right: -8, top: "50%", position: "absolute" }}
                  >
                    ›
                  </button>
                  <p
                    aria-live="polite"
                    style={{
                      position: "absolute",
                      bottom: -34,
                      left: 0,
                      right: 0,
                      textAlign: "center",
                      fontFamily: "var(--font-inter), system-ui, sans-serif",
                      fontSize: "0.72rem",
                      letterSpacing: "0.14em",
                      color: "rgba(248,242,232,0.75)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {openIndex + 1} / {images.length}
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
