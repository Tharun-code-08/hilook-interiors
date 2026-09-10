import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSessionLive, readSessionToken, type SessionPayload } from "./auth";
import { findUserById } from "./repos/operations";
import type { AdminUser } from "./types";

/**
 * The signed-in operator for an admin page, or a redirect to sign-in.
 *
 * Every server-rendered admin page awaits this before its first query, and the
 * dashboard layout awaits it as well.
 *
 * The check used to live in the layout alone, which did not protect the pages
 * under it. Next does not re-render a shared layout on client-side navigation,
 * so the request for a page's data ran with nothing in front of it but
 * middleware's test that some cookie was present. On a full load the layout and
 * the page render together, so the page's rows were streamed into the response
 * even when the layout redirected. Probed with a cookie copied before sign-out:
 * the navigation payload came back 200 with the inbox in it, and the redirect
 * to sign-in carried the same enquiries in its body. The API routes were never
 * affected; they check the session themselves.
 *
 * cache() makes this one lookup per request however many components ask, so
 * the layout and the page share it rather than repeating it. The session
 * record and the account row are fetched together, since the token names both.
 */
export const requireAdmin = cache(
  async (): Promise<{ session: SessionPayload; user: AdminUser }> => {
    const token = await readSessionToken();
    if (!token) redirect("/admin/login");

    const [live, user] = await Promise.all([isSessionLive(token), findUserById(token.sub)]);

    // A session that outlived the account it points at counts as signed out.
    if (!live || !user) redirect("/admin/login");

    return { session: token, user };
  }
);
