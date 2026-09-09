/**
 * Shared layout for the error / not-found / loading states.
 *
 * No "use client" directive: this is a purely presentational component with no
 * hooks or server-only imports, so it can be rendered from both the server
 * components (not-found, loading) and the client ones (error, global-error).
 */
export default function StatusPage({
  code,
  title,
  body,
  children,
}: {
  code: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F4F1EA",
        color: "#26231F",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(1.5rem, 6vw, 4rem)",
      }}
    >
      <div style={{ maxWidth: "44ch", width: "100%" }}>
        <p
          className="hi-label"
          style={{ marginBottom: "1.25rem", fontVariantNumeric: "tabular-nums" }}
        >
          {code}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontWeight: 400,
            fontSize: "clamp(1.9rem, 4.5vw, 2.9rem)",
            lineHeight: 1.15,
            textWrap: "balance",
            marginBottom: "1.1rem",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontWeight: 300,
            fontSize: "1.02rem",
            lineHeight: 1.75,
            color: "#5E5951",
            marginBottom: "2.25rem",
          }}
        >
          {body}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>{children}</div>
      </div>
    </main>
  );
}
