import type { Handle } from "@sveltejs/kit";
import { auth } from "./auth.js";

import "./bot.js";

export const handle: Handle = async ({ event, resolve }) => {
    console.log(
        `[${event.request.method}] ${event.url.href.substring(
            event.url.origin.length
        )}`
    );

    return await auth.check({ event, resolve });
};
