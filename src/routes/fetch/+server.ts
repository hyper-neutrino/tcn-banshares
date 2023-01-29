import { escape } from "svelte/internal";
import { aborted } from "../../abort.js";
import bot from "../../bot.js";
import type { RequestHandler } from "./$types.js";

export const POST: RequestHandler = async ({ request, url }) => {
    const session = url.searchParams.get("session");
    aborted.delete(session);

    if (!session)
        return new Response('{"error":"Missing Session"}', { status: 400 });

    const seen = new Set<string>();
    const tags: [string, string][] = [];

    for (const id of await request.json()) {
        if (seen.has(id)) continue;
        seen.add(id);

        if (aborted.has(session))
            return new Response('{"error":"Aborted"}', { status: 400 });

        try {
            tags.push([(await bot.users.fetch(id)).tag, id]);
        } catch {
            return new Response(
                JSON.stringify({
                    error: `Invalid ID: <code>${escape(
                        id
                    )}</code> did not correspond to a valid user.`,
                })
            );
        }
    }

    return new Response(JSON.stringify(tags));
};
