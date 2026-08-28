"use client";

import { useEffect, useRef } from "react";

/**
 * Fires one lightweight beacon the first time this section scrolls into
 * view, so the admin dashboard can report "popular sections". Purely
 * additive — never blocks or delays rendering of its children.
 */
export default function SectionTracker({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            fetch("/api/analytics/section", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ section: name }),
              keepalive: true,
            }).catch(() => {});
            observer.disconnect();
          }
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [name]);

  return <div ref={ref}>{children}</div>;
}
