import { auth } from "../../../auth.js";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async (event) => {
    return await auth.refresh(event);
};
