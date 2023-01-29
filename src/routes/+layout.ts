import type { Load } from "@sveltejs/kit";

export const load: Load = (event) => {
    return { user: (event.data as any).user };
};
