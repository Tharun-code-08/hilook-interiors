/**
 * Server-side error capture.
 *
 * `onRequestError` is Next's own hook for anything that throws while handling
 * a request — a Server Component, a route handler, middleware. Using it means
 * errors are recorded without every handler having to remember a try/catch,
 * which is the failure mode of hand-rolled reporting: it covers the paths
 * someone thought about and misses the ones they did not.
 *
 * Nothing is sent anywhere. See lib/repos/errors.ts for why this is
 * first-party rather than a hosted service.
 */
export async function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  }
) {
  // Node only.
  //
  // This module is loaded into every runtime Next starts, Edge included, and
  // the error repository reaches node:crypto and the libSQL client — neither
  // of which exists there. A lazy import is not enough on its own: webpack
  // still follows it when building the Edge bundle, and the build fails on
  // "Import trace: node:crypto". The runtime check is what keeps that edge
  // out of the graph.
  //
  // Middleware failures are the cost, since middleware runs on Edge. They
  // still surface in the platform logs; they just do not reach this table.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { recordError } = await import("./lib/repos/errors");

  const userAgent = request.headers["user-agent"];

  await recordError({
    error,
    source: "server",
    path: request.path,
    method: request.method,
    // Deliberately not the session: resolving it here would mean reading
    // cookies and hitting the database on an already-failing request, and the
    // path plus stack is what actually identifies the bug.
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
  });
}

export async function register() {
  // Nothing to start up. Present because Next expects this export to exist
  // alongside onRequestError.
}
