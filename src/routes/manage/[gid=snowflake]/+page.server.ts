import type { PageServerLoad } from "../$types.js";

export const load: PageServerLoad = ({ cookies }) => {
    return { access_token: cookies.get("discord_access_token") };
};
