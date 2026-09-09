/**
 * Streaming fallback for the home route, and only the home route.
 *
 * It lives inside the (home) route group deliberately. At app/loading.tsx it
 * wrapped every segment in a Suspense boundary, so Next flushed the shell —
 * and with it a 200 status — before any page body ran. /work/<unknown-slug>
 * then called notFound(), rendered the 404 UI correctly, and still returned
 * 200, because the status had already gone out on the wire. That soft 404 is
 * exactly what a crawler indexes as a real page.
 *
 * The home page is the one route that genuinely wants this: it reads the
 * datastore before it can render anything, and without a fallback the browser
 * holds a blank document for that round trip. Routes that can 404 must not
 * stream their shell early, so they get no loading.tsx.
 *
 * Deliberately just the hero's ground colour and a quiet mark, not a skeleton
 * of the layout — the hero canvas paints over this within a frame, and a
 * skeleton that flashes and is replaced reads worse than a calm hold.
 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      style={{
        minHeight: "100vh",
        background: "#F4F1EA",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        className="hi-label"
        style={{
          animation: "hi-pulse 1.6s ease-in-out infinite",
        }}
      >
        Hilook Interiors
      </p>
    </div>
  );
}
