import type { Settings } from "@/lib/types";

/**
 * Floating contact affordances.
 *
 * These previously rendered the literal strings "WA" and "Call" inside gold
 * and green circles — an abbreviation nobody outside the build would parse,
 * set in a font that was never meant to work at 0.65rem in a 48px puck. Real
 * glyphs, and the labels stay in aria-label where they belong.
 */

function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.42 8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07s.89 2.4 1.01 2.56c.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.03-.24c1.12.37 2.33.57 3.56.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.44.57 3.56a1 1 0 0 1-.25 1.03l-2.2 2.2Z" />
    </svg>
  );
}

const PUCK: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  // The hover lift is .hi-puck in globals.css. This transition used to name
  // transform and box-shadow with no hover rule anywhere to drive either.
  transition: "transform var(--hi-dur) var(--hi-ease)",
};

export default function FloatingContactButton({ settings }: { settings: Settings }) {
  const waLink = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}`
    : null;
  const telLink = `tel:${settings.contactPhone.replace(/\s+/g, "")}`;

  return (
    <div
      className="hi-floating-contact"
      style={{
        position: "fixed",
        right: "1.25rem",
        bottom: "1.25rem",
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
      }}
    >
      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          className="hi-puck hi-focusable"
          style={{
            ...PUCK,
            background: "#1F7A5A",
            color: "#F8F2E8",
            boxShadow: "0 6px 20px rgba(23,63,53,0.32)",
          }}
        >
          <WhatsAppIcon />
        </a>
      )}
      <a
        href={telLink}
        aria-label={`Call ${settings.siteName} on ${settings.contactPhone}`}
        className="hi-puck hi-focusable"
        style={{
          ...PUCK,
          background: "var(--hi-accent)",
          color: "#F8F2E8",
          boxShadow: "0 6px 20px rgba(176,138,74,0.34)",
        }}
      >
        <PhoneIcon />
      </a>
    </div>
  );
}
