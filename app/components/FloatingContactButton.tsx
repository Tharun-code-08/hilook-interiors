import type { Settings } from "@/lib/db";

export default function FloatingContactButton({ settings }: { settings: Settings }) {
  const waLink = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}`
    : null;
  const telLink = `tel:${settings.contactPhone.replace(/\s+/g, "")}`;

  return (
    <div
      style={{
        position: "fixed",
        right: "1.25rem",
        bottom: "1.25rem",
        zIndex: 90,
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
          aria-label="Chat on WhatsApp"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#173F35",
            color: "#F8F2E8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-inter)",
            fontSize: "0.65rem",
            letterSpacing: "0.05em",
            boxShadow: "0 6px 20px rgba(23,63,53,0.35)",
          }}
        >
          WA
        </a>
      )}
      <a
        href={telLink}
        aria-label="Call us"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#B08A4A",
          color: "#F8F2E8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-inter)",
          fontSize: "0.65rem",
          letterSpacing: "0.05em",
          boxShadow: "0 6px 20px rgba(176,138,74,0.35)",
        }}
      >
        Call
      </a>
    </div>
  );
}
