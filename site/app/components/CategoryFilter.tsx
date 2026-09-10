"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The portfolio's category filter.
 *
 * Replaces three bordered pills. Boxed chips are what every template ships,
 * and on a page whose whole visual argument is restraint — hairline rules,
 * generous space, one serif doing the talking — a row of outlined buttons was
 * the one element announcing that it came from a kit.
 *
 * This is the editorial form instead: the labels sit on a hairline, and a
 * single rule slides to whichever is active. The rule is the same weight as
 * every other rule on the page, so the control belongs to the layout rather
 * than sitting on top of it.
 *
 * The movement is a translate and a scale on one element, never a width or a
 * left, so it stays on the compositor and cannot cause layout work mid-slide.
 * The indicator is 1px wide by default and scaled to the tab's width, which is
 * why transformOrigin has to be "left".
 */

export default function CategoryFilter<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<{ x: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const list = listRef.current;
    const active = buttonRefs.current.get(value);
    if (!list || !active) return;

    // offsetLeft is relative to the positioned list, which is what the
    // translate below is measured against.
    setIndicator({ x: active.offsetLeft, width: active.offsetWidth });
  }, [value]);

  // Layout effect, not effect: the indicator must be in place on the first
  // paint after a change, or it visibly jumps from the old position.
  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;

    // The labels reflow with the viewport and with the font once it loads,
    // and either moves the tab the indicator is pinned to.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const el of buttonRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  /**
   * Arrow keys move between filters, which is what a tablist affords.
   *
   * Not role="tablist" though: these filter a list that stays on the page
   * rather than switching panels, and claiming the tab pattern would promise a
   * relationship to a tabpanel that does not exist. aria-pressed on each
   * button describes what is actually happening.
   */
  function onKeyDown(event: React.KeyboardEvent) {
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (direction === 0) return;

    event.preventDefault();
    const index = options.indexOf(value);
    const next = options[(index + direction + options.length) % options.length];
    onChange(next);
    buttonRefs.current.get(next)?.focus();
  }

  return (
    <div ref={listRef} className="hi-filter" role="group" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            ref={(el) => {
              if (el) buttonRefs.current.set(option, el);
              else buttonRefs.current.delete(option);
            }}
            type="button"
            aria-pressed={selected}
            // Only the active filter is a tab stop. Tabbing through three
            // options to reach the grid is noise; the arrow keys move between
            // them, which is the same bargain a radio group makes.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option)}
            className={`hi-filter-option${selected ? " is-active" : ""}`}
          >
            {option}
          </button>
        );
      })}

      <span
        aria-hidden="true"
        className="hi-filter-rule"
        style={
          indicator
            ? {
                transform: `translateX(${indicator.x}px) scaleX(${indicator.width})`,
                opacity: 1,
              }
            : { opacity: 0 }
        }
      />
    </div>
  );
}
