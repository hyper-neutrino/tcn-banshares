import type { ServerLoad } from "@sveltejs/kit";

export const load: ServerLoad = (event) => {
    return { user: (event.locals as any).user };
};
