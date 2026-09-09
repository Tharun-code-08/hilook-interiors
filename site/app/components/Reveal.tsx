"use client";

import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.25, 0, 0, 1] as const;

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
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
