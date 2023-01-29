import type { ParamMatcher } from "@sveltejs/kit";

export const match: ParamMatcher = (param) =>
    !!param.match(/^[1-9][0-9]{16,19}$/);
