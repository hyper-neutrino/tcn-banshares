import { ALERT, CHANNEL, NON_URGENT, URGENT } from "$env/static/private";
import { PUBLIC_TCN_API } from "$env/static/public";
import { fail, type Actions } from "@sveltejs/kit";
import { ButtonStyle, ComponentType } from "discord.js";
import { escape } from "svelte/internal";
import bot from "../bot.js";
import db from "../db.js";
import { create_gist } from "../gists.js";
import { components } from "../lib.js";

function compare(a: string, b: string): number {
    if (!a.match(/^\d+$/))
        if (!b.match(/^\d+$/)) return a.localeCompare(b);
        else return -1;
    else if (!b.match(/^\d+$/)) return 1;

    const diff = BigInt(a) - BigInt(b);
    return diff > 0 ? 1 : diff < 0 ? -1 : 0;
}

export const actions: Actions = {
    default: async ({ request, locals, fetch }) => {
        const data = await request.formData();
        const user = (locals as any).user;

        if (!user) return fail(500, { error: "Not Authenticated" });

        const ids = (data.get("ids") as string).trim();
        const reason = (data.get("reason") as string).trim();
        const evidence = (data.get("evidence") as string).trim();
        const server = data.get("server") as string;
        const severity = data.get("severity") as string;
        const urgent = data.has("urgent");

        const action = (data.get("submit") as string) ?? "Submit";

        const values = {
            ids,
            reason,
            evidence,
            server,
            severity,
            urgent,
        };

        const abort = (code: number, message: string) =>
            fail(code, {
                error: message,
                ...values,
            });

        if (ids.length === 0)
            return abort(400, "You must enter at least one user to banshare.");

        if (!reason) return abort(400, "You must enter a non-empty reason.");
        if (!evidence) return abort(400, "You must enter some evidence.");
        if (!server) return abort(400, "You must select the server.");
        if (!severity) return abort(400, "You must select the severity.");

        if (!["low", "medium", "critical"].includes(severity))
            return abort(400, "Invalid severity selection.");

        if (reason.length > 498)
            return abort(400, "Maximum reason length is 498.");

        if (evidence.length > 1200)
            return abort(
                400,
                "Maximum evidence length is 1200. If you need more space, please create and link a document and include some basic information about it in the evidence field."
            );

        const tcn_request = await fetch(`${PUBLIC_TCN_API}/users/${user.id}`);

        if (!tcn_request.ok)
            return abort(
                400,
                "You do not appear to be a staff member of any TCN servers. Contact your server owner or a TCN observer if you believe this is a mistake."
            );

        const tcn_data = await tcn_request.json();

        if (!tcn_data.guilds.includes(server))
            return abort(
                400,
                "You are not a staff member on the server you selected."
            );

        const server_request = await fetch(
            `${PUBLIC_TCN_API}/guilds/${server}`
        );

        if (!server_request.ok)
            return abort(
                400,
                "The server you selected does not appear to be in the TCN. (This message should never appear...)"
            );

        const server_name = (await server_request.json()).name;

        if (!bot.user)
            return abort(
                500,
                "Banshare bot is not ready to handle your request yet. Please wait for a few seconds."
            );

        const channel = bot.channels.cache.get(CHANNEL as string);

        if (!channel?.isTextBased())
            return abort(
                500,
                "Banshare bot is not configured correctly: output channel is not a valid text-based channel."
            );

        let id_list: string[] = [];
        const tags: string[] = [];

        let ids_output: string = ids;

        if (action === "Submit") {
            id_list = [...new Set(ids.trim().split(/\s+/))].sort(compare);

            for (const id of id_list)
                if (!id.match(/^[1-9][0-9]{16,19}$/))
                    return abort(
                        400,
                        `Invalid ID: <code>${escape(
                            id
                        )}</code> is not a valid Discord ID.`
                    );

            for (const id of id_list)
                try {
                    tags.push((await bot.users.fetch(id)).tag);
                } catch {
                    return abort(
                        400,
                        `Invalid ID: <code>${escape(
                            id
                        )}</code> did not correspond to a valid user.`
                    );
                }

            ids_output = id_list.join(" ");
        }

        const format = (ids: string, tags: string) =>
            `**ID(s):** ${ids}\n${
                tags.length > 0 ? `**Username(s):** ${tags}\n` : ""
            }**Reason:** ${reason}\n**Evidence:** ${evidence}\n**Submitted by:** ${
                user.username
            }#${user.discriminator} (\`${
                user.id
            }\`) from ${server_name}\n**Severity:** ${
                severity[0].toUpperCase() + severity.slice(1)
            }`;

        let message: string = format(ids_output, tags.join(" "));

        if (message.length > 2000) {
            const iso = new Date().toISOString();

            try {
                message = format(
                    await create_gist(
                        `banshare-ids-${iso}`,
                        `IDs for the banshare on ${iso}`,
                        ids_output
                    ),
                    ""
                );
            } catch {
                return abort(
                    500,
                    "Uploading your ID list / user tag list to as a gist failed."
                );
            }
        }

        const post = await channel.send({
            content: message,
            components: components(false, severity),
        });

        await db.banshares.insertOne({
            message: post.id,
            url: post.url,
            server,
            id_list,
            reason,
            severity,
        });

        if (ALERT) {
            const alert = bot.channels.cache.get(ALERT);
            if (alert?.isTextBased())
                try {
                    await alert.send(
                        `${
                            (urgent ? URGENT : NON_URGENT) ?? ""
                        } A banshare was just posted in ${channel} for review${
                            urgent ? " (**urgent**)" : ""
                        }. If you wish to alter the severity, use the buttons below the banshare **before** publishing.`
                    );
                } catch {}
        }

        return { success: true };
    },
};
