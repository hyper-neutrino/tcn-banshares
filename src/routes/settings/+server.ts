import { auth_server } from "../../auth.js";
import db from "../../db.js";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async ({ cookies, url }) => {
    const response = await auth_server({ cookies, url });
    if (response) return response;

    const data: any = (await db.settings.findOne({
        guild: url.searchParams.get("gid"),
    })) ?? { _id: null };

    delete data._id;

    return new Response(JSON.stringify(data));
};

export const POST: RequestHandler = async ({ cookies, url, request }) => {
    const response = await auth_server({ cookies, url });
    if (response) return response;

    try {
        await db.settings.findOneAndUpdate(
            { guild: url.searchParams.get("gid") },
            { $set: await request.json() },
            { upsert: true }
        );
    } catch (error) {
        console.error(error);

        return new Response(
            '{"error":"Database error; please try again in a bit."}'
        );
    }

    return new Response("{}");
};
