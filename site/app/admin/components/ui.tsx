/**
 * Admin primitives.
 *
 * Thin wrappers over the classes in admin.css — deliberately thin. The
 * styling lives in the stylesheet where it can be read in one place; these
 * exist for the parts a class cannot carry: variant-to-class mapping that the
 * type system can check, and the label/input/description wiring that is easy
 * to get subtly wrong for screen readers and easy to forget entirely.
 *
 * Anything that is only ever a class (`ad-card`, `ad-stack`, `ad-row`) stays a
 * class. A component per div would just be a second vocabulary to learn.
 */
"use client";

import { useId } from "react";

/* -------------------------------------------------------------------------
 * Button
 * ---------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-quiet";

export function Button({
  variant = "secondary",
  size,
  block,
  className,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm";
  block?: boolean;
  /** React 19 hands function components ref as a normal prop; dialogs need it
      to move focus onto the confirming action. */
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const classes = [
    "ad-btn",
    `ad-btn--${variant}`,
    size === "sm" ? "ad-btn--sm" : "",
    block ? "ad-btn--block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classes} {...rest} />;
}

/* -------------------------------------------------------------------------
 * Fields
 *
 * Every control gets a real <label for>, and a hint or error is wired through
 * aria-describedby rather than left as a loose <p> the control never
 * references. Passing `error` also sets aria-invalid, so the failure is
 * announced and not only coloured.
 * ---------------------------------------------------------------------- */

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string;
  /** Hide the label visually but keep it for screen readers. */
  hiddenLabel?: boolean;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => React.ReactNode;
};

export function Field({ label, hint, error, hiddenLabel, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="ad-field">
      <label className={hiddenLabel ? "ad-sr" : "ad-label"} htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error && (
        <p className="ad-error" id={errorId}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="ad-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  hiddenLabel,
  seamless,
  title,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "title"> & {
  label: string;
  hint?: string;
  error?: string;
  hiddenLabel?: boolean;
  /** Chromeless until hovered — for edit-in-place rows. */
  seamless?: boolean;
  /** Renders at title weight. Pairs with `seamless` for record headings. */
  title?: boolean;
}) {
  const classes = ["ad-input", seamless ? "ad-input--seamless" : "", title ? "ad-input--title" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <Field label={label} hint={hint} error={error} hiddenLabel={hiddenLabel}>
      {(a11y) => <input className={classes} {...a11y} {...rest} />}
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  error,
  hiddenLabel,
  seamless,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  hiddenLabel?: boolean;
  seamless?: boolean;
}) {
  const classes = ["ad-textarea", seamless ? "ad-input--seamless" : ""].filter(Boolean).join(" ");

  return (
    <Field label={label} hint={hint} error={error} hiddenLabel={hiddenLabel}>
      {(a11y) => <textarea className={classes} {...a11y} {...rest} />}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  hiddenLabel,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  hiddenLabel?: boolean;
}) {
  return (
    <Field label={label} hint={hint} error={error} hiddenLabel={hiddenLabel}>
      {(a11y) => (
        <select className="ad-select" {...a11y} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Checkbox({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="ad-checkbox">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/* -------------------------------------------------------------------------
 * Page furniture
 * ---------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="ad-page-head">
      <div>
        <h1 className="ad-page-title">{title}</h1>
        {description && <p className="ad-page-sub">{description}</p>}
      </div>
      {actions && <div className="ad-row">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  footer,
  bodyless,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Skip the padded body — for a table that should meet the card edges. */
  bodyless?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="ad-card">
      {(title || actions) && (
        <div className="ad-card-head">
          <div>
            {title && <h2 className="ad-card-title">{title}</h2>}
            {description && <p className="ad-card-sub">{description}</p>}
          </div>
          {actions && <div className="ad-row">{actions}</div>}
        </div>
      )}
      {bodyless ? children : <div className="ad-card-body">{children}</div>}
      {footer && <div className="ad-card-foot">{footer}</div>}
    </section>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "danger" | "warn" | "info";
  children: React.ReactNode;
}) {
  const cls = tone === "neutral" ? "ad-badge" : `ad-badge ad-badge--${tone}`;
  return <span className={cls}>{children}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="ad-empty">
      <p className="ad-empty-title">{title}</p>
      {children}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "danger";
  children: React.ReactNode;
}) {
  return <div className={`ad-banner ad-banner--${tone}`}>{children}</div>;
}

/**
 * The panel's one loading state.
 *
 * role="status" so a screen reader is told the region is busy instead of
 * finding it briefly empty and then silently repopulated.
 */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="ad-empty" role="status">
      {label}
    </p>
  );
}
