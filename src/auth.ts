import { DiscordOAuth2 } from "@daedalus-discord/webkit";
import dotenv from "dotenv";
import type { Cookies } from "@sveltejs/kit";
import {
    CALLBACK,
    CLIENT_ID,
    CLIENT_SECRET,
    DOMAIN,
    REFRESH,
} from "$env/static/private";
import { PUBLIC_DIS_API, PUBLIC_TCN_API } from "$env/static/public";

dotenv.config();

export const auth = new DiscordOAuth2(
    CLIENT_ID as string,
    CLIENT_SECRET as string,
    CALLBACK as string,
    REFRESH as string,
    DOMAIN as string,
    ["identify", "guilds"]
);

export async function auth_server({
    cookies,
    url,
}: {
    cookies: Cookies;
    url: URL;
}) {
    const fail = (error: string) => new Response(JSON.stringify({ error }));

    const gid = url.searchParams.get("gid");
    if (!gid?.match(/^[1-9][0-9]{16,19}$/)) return fail("Invalid guild ID.");

    try {
        const [tcn_request, discord_request] = await Promise.all([
            fetch(`${PUBLIC_TCN_API}/guilds/${gid}`),
            fetch(`${PUBLIC_DIS_API}/users/@me/guilds`, {
                headers: {
                    Authorization: `Bearer ${cookies.get(
                        "discord_access_token"
                    )}`,
                },
            }),
        ]);

        if (gid !== "927153548339343360" && !tcn_request.ok)
            return fail("The ID you provided is not a TCN server.");
        if (!discord_request.ok)
            if (discord_request.status === 429)
                return fail(
                    "Discord API ratelimit hit. Please try again in a bit."
                );
            else return fail("Discord API error. Please try logging in again.");

        if (
            (((await discord_request.json()).find(
                (server: { id: string }) => server.id === gid
            )?.permissions ?? 0) &
                8) ===
            0
        )
            return fail("You are not an admin of this server.");
    } catch {
        return fail(
            "Fetching data from either Discord or the TCN API failed. Please try again later."
        );
    }
}
