import type { PageLoad } from "./$types.js";

export const load: PageLoad = ({ data, params }) => {
    return { ...data, gid: params.gid };
};
