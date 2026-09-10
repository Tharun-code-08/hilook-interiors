"use client";

import { motion, useReducedMotion } from "framer-motion";

import { EASE } from "./motion-tokens";

/**
 * Fades content up as it scrolls into view. Used by every section of the
 * public site.
 *
 * Honours prefers-reduced-motion, which it previously did not. globals.css has
 * a blanket reduce rule that flattens animation-duration and
 * transition-duration, and that made the site look as though the preference
 * was handled — but framer-motion animates by writing inline styles from
 * JavaScript, which no CSS rule can reach. Every section on the page kept
 * sliding and fading for someone who had asked the whole system not to.
 *
 * Under the preference the content is simply present: no initial state, no
 * transition, nothing to wait through. That also makes the accessibility
 * scans deterministic, since axe was otherwise sampling colours part-way
 * through a fade and reading contrast ratios that existed for 300ms.
 */

/** How far content travels: enough to read as arriving, not as sliding. */
const TRAVEL_PX = 14;
const DURATION_S = 0.62;

/**
 * Per-item delay, and the ceiling on it.
 *
 * The delay used to be `index * 0.1` with nothing capping it, and two callers
 * pass a list index straight through. A twelve-project grid therefore left its
 * last card waiting 1.2s after it had already scrolled into view, which does
 * not read as a stagger — it reads as a page that has stopped working.
 *
 * Capped, the effect is what a stagger is actually for: enough offset to feel
 * like the items arrived in order, over before anyone waits on it.
 */
const STAGGER_S = 0.07;
const MAX_STAGGERED_ITEMS = 5;

export default function Reveal({
  children,
  index = 0,
  className,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: TRAVEL_PX }}
      whileInView={{ opacity: 1, y: 0 }}
      // once: the content settles and stays settled. Re-animating on every
      // pass turns scrolling back up into a performance.
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: DURATION_S,
        delay: Math.min(index, MAX_STAGGERED_ITEMS) * STAGGER_S,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}
