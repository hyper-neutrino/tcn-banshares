import { ALERT, CHANNEL, DDL_TOKEN, LOG, TOKEN } from "$env/static/private";
import {
    PUBLIC_ALLOWLIST,
    PUBLIC_DDL_API,
    PUBLIC_TCN_API,
} from "$env/static/public";
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ButtonInteraction,
    ButtonStyle,
    Client,
    ComponentType,
    Guild,
    IntentsBitField,
    Message,
    ModalSubmitInteraction,
    PermissionFlagsBits,
    StringSelectMenuInteraction,
    TextInputStyle,
    User,
    type Interaction,
    type StringSelectMenuComponentData,
} from "discord.js";
import db from "./db.js";
import { components } from "./lib.js";

process.on("uncaughtException", (error) => console.error(error));

const bot = new Client({
    intents:
        IntentsBitField.Flags.Guilds | IntentsBitField.Flags.MessageContent,
});

const finished = [
    {
        type: ComponentType.ActionRow,
        components: [
            {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                customId: "/",
                label: "Banshare Executed",
                disabled: true,
            },
        ],
    },
] as any;

const rescinded = [
    {
        type: ComponentType.ActionRow,
        components: [
            {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                customId: "/",
                label: "Banshare Rescinded",
                disabled: true,
            },
        ],
    },
] as any;

const report = [
    {
        type: ComponentType.ActionRow,
        components: [
            {
                type: ComponentType.StringSelect,
                customId: "report-preset",
                minValues: 1,
                maxValues: 3,
                options: [
                    "Appears unintended.",
                    "Targeted users are wrong.",
                    "Reason does not justify a banshare.",
                    "Evidence is insufficient.",
                    "Evidence is forged.",
                ].map((text) => ({ label: text, value: text })),
                placeholder: "Report This Banshare",
            } satisfies StringSelectMenuComponentData,
        ],
    },
    {
        type: ComponentType.ActionRow,
        components: [
            {
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                customId: "report",
                label: "Report (Custom Reason)",
            },
        ],
    },
] as any;

const published = new Set<string>();

bot.once("ready", async () => {
    console.log("[BOT] starting...");

    await bot.application?.commands.create({
        type: ApplicationCommandType.ChatInput,
        name: "banshare",
        description: "control banshare settings",
        defaultMemberPermissions: PermissionFlagsBits.Administrator,
        dmPermission: false,
        options: [
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: "post",
                description: "control banshare posting settings",
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: "here",
                        description:
                            "set the banshare output channel to the current channel",
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: "none",
                        description:
                            "unset the banshare output channel and stop receiving banshares",
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: "log",
                description: "control banshare logging settings",
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: "here",
                        description:
                            "set the banshare log channel to the current channel",
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: "none",
                        description:
                            "unset the banshare log channel and stop logging",
                    },
                ],
            },
        ],
    });

    console.log("[BOT] ready!");
});

bot.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
        await interaction.deferReply({ ephemeral: true });

        if (!(await allowed(interaction.guild!))) {
            await interaction.editReply("This is not a TCN server.");

            return;
        }

        if (interaction.commandName === "banshare") {
            const subgroup = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand(false);

            if (subgroup === "post") {
                if (subcommand === "here") {
                    await db.channels.findOneAndUpdate(
                        { guild: interaction.guild!.id },
                        { $set: { channel: interaction.channel!.id } },
                        { upsert: true }
                    );

                    await interaction.editReply(
                        "Banshares will now be posted here."
                    );
                } else if (subcommand === "none") {
                    await db.channels.findOneAndDelete({
                        guild: interaction.guild!.id,
                    });

                    await interaction.editReply(
                        "You will no longer receive banshares."
                    );
                }
            } else if (subgroup === "log") {
                if (subcommand === "here") {
                    await db.logging.findOneAndUpdate(
                        { guild: interaction.guild!.id },
                        { $set: { channel: interaction.channel!.id } },
                        { upsert: true }
                    );

                    await interaction.editReply(
                        "Logs will now be posted here."
                    );
                } else if (subcommand === "none") {
                    await db.logging.findOneAndDelete({
                        guild: interaction.guild!.id,
                    });

                    await interaction.editReply(
                        "Logs will no longer be posted."
                    );
                }
            }
        }
    } else if (interaction.isButton()) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers))
            return;
        else if (interaction.customId === "cancel-autoban")
            await interaction.update({
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                customId: "ban",
                                label: "Ban",
                            },
                        ],
                    },
                    ...report,
                ],
            });
        else if (interaction.customId === "ban") {
            const banshare = await get_banshare(
                interaction,
                interaction.message.id
            );
            if (!banshare) return;

            await interaction.reply({
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                customId: "/",
                                label: "Fetching users...",
                                disabled: true,
                            },
                        ],
                    },
                ],
                ephemeral: true,
            });

            const users: User[] = [];

            for (const id of banshare.id_list as string[])
                try {
                    users.push(await bot.users.fetch(id));
                } catch {}

            try {
                await interaction.editReply({
                    content: users.join(", "),
                    components: confirm(false, "-ban"),
                });
            } catch {
                await interaction.editReply({
                    files: [
                        {
                            attachment: Buffer.from(
                                users
                                    .map((user) => `${user.tag} (${user.id})`)
                                    .join(", "),
                                "utf-8"
                            ),
                            name: "user-list.txt",
                        },
                    ],
                    components: confirm(false, "-ban"),
                });
            }
        } else if (interaction.customId === "report") {
            if (!bot.channels.cache.has(ALERT)) {
                await interaction.reply({
                    content:
                        "The output channel does not appear to be set up correctly, so your report would not be able to be sent.",
                });

                return;
            }

            await interaction.showModal({
                title: "Report Banshare",
                customId: "confirm-report",
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                style: TextInputStyle.Paragraph,
                                customId: "reason",
                                label: "Reason",
                                placeholder:
                                    "Explain why you believe this banshare is problematic and should be rescinded.",
                                minLength: 50,
                                maxLength: 1800,
                                required: true,
                            },
                        ],
                    },
                ],
            });
        } else if (interaction.customId === "cancel-ban")
            await interaction.update({
                content: null,
                files: [],
                components: confirm(true, "-ban"),
            });
        else if (interaction.customId === "confirm-ban") {
            let message: Message;

            try {
                message = await interaction.message.fetchReference();
            } catch {
                await interaction.update({
                    content:
                        "The banshare being referred to has been deleted, so it cannot be executed.",
                    files: [],
                    components: [],
                });

                return;
            }

            const banshare = await get_banshare(
                interaction,
                interaction.message.reference?.messageId ?? ""
            );

            if (!banshare) return;

            const lock = await db.executed.findOneAndUpdate(
                { post: interaction.message.id },
                { $set: { executed: true } }
            );

            if (lock.value?.executed) {
                await interaction.update({
                    content:
                        "This banshare is already being executed by someone else.",
                    files: [],
                    components: [],
                });

                return;
            }

            await interaction.update({
                content: "Executing...",
                files: [],
                components: [],
            });

            await execute(
                banshare,
                await db.settings.findOne({ guild: interaction.guild!.id }),
                interaction.guild!,
                message,
                interaction.user
            );

            await interaction.editReply("Banshare executed!");
            await message.edit({ components: finished.concat(report) });
        } else if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.Administrator
            )
        )
            return;
        else if (interaction.customId.startsWith("sev:")) {
            const severity = interaction.customId.substring(4);

            await db.banshares.findOneAndUpdate(
                { message: interaction.message.id },
                { $set: { severity } }
            );

            await interaction.update({
                content:
                    interaction.message.content.substring(
                        0,
                        interaction.message.content.lastIndexOf(" ")
                    ) +
                    " " +
                    severity[0].toUpperCase() +
                    severity.substring(1),
                components: components(false, severity),
            });
        } else if (interaction.customId === "publish") {
            if (
                published.has(interaction.message.id) ||
                (await db.banshares.findOne({
                    message: interaction.message.id,
                    published: true,
                }))
            )
                await interaction.reply({
                    content:
                        "This banshare has been published by someone else already.",
                    ephemeral: true,
                });
            else
                await interaction.reply({
                    components: confirm(),
                    ephemeral: true,
                });
        } else if (interaction.customId === "confirm") {
            await interaction.deferUpdate();
            let guilds: string[];

            try {
                const request = await fetch(`${PUBLIC_TCN_API}/guilds`);

                if (!request.ok) throw 0;

                guilds = (await request.json())
                    .map((server: { id: string }) => server.id)
                    .concat(PUBLIC_ALLOWLIST.split(/\s+/));
            } catch {
                await interaction.editReply(
                    "An unexpected issue occurred with the TCN API."
                );

                return;
            }

            const id = interaction.message.reference?.messageId ?? "";
            const fail = published.has(id);
            published.add(id);
            setTimeout(() => published.delete(id), 10000);

            const banshare = await db.banshares.findOneAndUpdate(
                { message: id },
                { $set: { published: true } }
            );

            if (!banshare.value)
                await interaction.editReply({
                    content: "This does not appear to be a banshare.",
                    components: [],
                });
            else if (fail || banshare.value.executed)
                await interaction.editReply({
                    content:
                        "This banshare has been published by someone else already.",
                    components: [],
                });
            else {
                let content: string;

                try {
                    const message = await interaction.message.fetchReference();
                    await message.edit({ components: components(true) });
                    content = message.content;
                } catch {
                    await interaction.editReply({
                        content: "The original banshare could not be found.",
                        components: [],
                    });

                    return;
                }

                await interaction.editReply({
                    content:
                        "Banshare is being published! You may dismiss this message.",
                    components: [],
                });

                const channel = interaction.client.channels.cache.get(
                    LOG ?? ""
                );

                const log = channel?.isTextBased()
                    ? channel.send.bind(channel)
                    : () => {};

                await log({
                    content: `${interaction.user} published <${interaction.message.url}>.`,
                    allowedMentions: { parse: [] },
                });

                const places = (await db.channels.find().toArray())
                    .filter(
                        (entry) =>
                            (PUBLIC_ALLOWLIST &&
                                PUBLIC_ALLOWLIST.indexOf(entry.guild) !== -1) ||
                            guilds.includes(entry.guild)
                    )
                    .map((entry) => ({
                        guild: entry.guild,
                        channel: bot.channels.cache.get(entry.channel),
                    }))
                    .filter(({ channel }) => channel?.isTextBased());

                await Promise.all(
                    places.map(async ({ guild, channel }) => {
                        if (!channel?.isTextBased()) return;

                        const settings = await db.settings.findOne({
                            guild,
                        });

                        let threshold =
                            settings?.autoban?.[banshare.value!.server];

                        if (threshold === "default" || !threshold)
                            threshold = settings?.autoban?.global ?? "none";

                        let components: any[] = [];

                        if (!banshare.value!.id_list?.length) {
                            // Submitted without checking IDs, so no automation is possible.
                        } else if (
                            autoban(threshold, banshare.value!.severity)
                        ) {
                            components = [
                                {
                                    type: ComponentType.ActionRow,
                                    components: [
                                        {
                                            type: ComponentType.Button,
                                            style: ButtonStyle.Secondary,
                                            customId: "-",
                                            label: "Auto-ban scheduled",
                                            disabled: true,
                                        },
                                        {
                                            type: ComponentType.Button,
                                            style: ButtonStyle.Danger,
                                            customId: "cancel-autoban",
                                            label: "Cancel",
                                        },
                                    ],
                                },
                                ...report,
                            ];
                        } else if (settings?.button) {
                            components = [
                                {
                                    type: ComponentType.ActionRow,
                                    components: [
                                        {
                                            type: ComponentType.Button,
                                            style: ButtonStyle.Danger,
                                            customId: "ban",
                                            label: "Ban",
                                        },
                                    ],
                                },
                                ...report,
                            ];
                        }

                        const post = await channel.send({
                            content,
                            components,
                        });

                        await save(banshare, guild, post);
                    })
                );

                places.forEach(async ({ guild, channel }) => {
                    if (!channel?.isTextBased()) return;

                    const message = await get_post(banshare, guild);
                    if (!message) return;

                    if (
                        message.components?.[0]?.components?.[0]?.customId !==
                        "-"
                    )
                        return;

                    await message.edit({
                        components: [
                            {
                                type: ComponentType.ActionRow,
                                components: [
                                    {
                                        type: ComponentType.Button,
                                        style: ButtonStyle.Secondary,
                                        customId: "/",
                                        label: "Auto-banning...",
                                        disabled: true,
                                    },
                                ],
                            },
                            ...report,
                        ],
                    });

                    await execute(
                        banshare.value,
                        await db.settings.findOne({ guild }),
                        message.guild!,
                        message
                    );

                    await message.edit({
                        components: finished.concat(report),
                    });
                });
            }
        } else if (interaction.customId === "cancel") {
            await interaction.update({
                components: confirm(true).concat(report),
            });
        } else if (interaction.customId === "rescind") {
            await interaction.showModal({
                title: "Rescind Banshare",
                customId: "confirm-rescind",
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                style: TextInputStyle.Paragraph,
                                customId: "explanation",
                                label: "Explanation",
                                minLength: 50,
                                maxLength: 1800,
                                required: true,
                                placeholder:
                                    "Why is this banshare being rescinded and why was it published initially?",
                            },
                        ],
                    },
                ],
            });
        }
    } else if (interaction.isModalSubmit()) {
        if (interaction.customId === "confirm-rescind") {
            await interaction.deferReply({ ephemeral: true });

            const lock = await db.banshares.findOneAndUpdate(
                { message: interaction.message!.id },
                { $set: { rescinded: true } }
            );

            if (lock.value?.rescinded) {
                await interaction.editReply(
                    "This banshare is already being rescinded by someone else."
                );

                return;
            }

            try {
                await interaction.message!.edit({
                    components: rescinded,
                });
            } catch (error) {
                console.error(error);
            }

            await interaction.editReply(
                "This banshare is being rescinded. You may dismiss this message."
            );

            const explanation =
                "This banshare has been rescinded by an observer. The explanation given is below:\n\n" +
                interaction.fields.getTextInputValue("explanation");

            await interaction.message!.reply(explanation);

            for (const post of await db.banshare_posts
                .find({ banshare: interaction.message!.id })
                .toArray()) {
                try {
                    const channel = await bot.channels.fetch(post.channel);
                    if (!channel?.isTextBased()) throw 0;

                    const message = await channel.messages.fetch(post.message);
                    await message
                        .edit({ components: rescinded })
                        .catch(() => {});
                    await message.reply(explanation);
                } catch {}
            }
        } else if (interaction.customId === "confirm-report") {
            await process_report(
                interaction,
                interaction.fields.getTextInputValue("reason")
            );
        }
    } else if (interaction.isStringSelectMenu()) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers))
            return;

        if (interaction.customId === "report-preset") {
            await process_report(interaction, interaction.values.join(" "));
        }
    }
});

async function process_report(
    interaction: ModalSubmitInteraction | StringSelectMenuInteraction,
    reason: string
) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const entry = await db.banshare_posts.findOne({
            message: interaction.message!.id,
        });

        if (!entry) throw 0;

        const banshare = await db.banshares.findOne({
            message: entry.banshare,
        });

        if (!banshare) throw 0;

        const channel = await bot.channels.fetch(ALERT);
        if (!channel?.isTextBased()) throw 0;

        await channel.send({
            content: `${interaction.user} reported a banshare: <${banshare.url}>:\n\n${reason}`,
            allowedMentions: { parse: [] },
        });
    } catch {
        await interaction.editReply("Posting your report failed.");
        return;
    }

    await interaction.editReply(
        "Your report has been submitted and will be reviewed by the observers."
    );
}

async function get_banshare(interaction: ButtonInteraction, message: string) {
    if (!(await allowed(interaction.guild!))) {
        await interaction.reply({
            content:
                "This server is not in the TCN. You can ban these users manually at your own judgement.",
            ephemeral: true,
        });

        return;
    }

    const post = await db.banshare_posts.findOne({ message });

    if (!post) {
        await interaction.reply({
            content: "This message is missing from the database.",
            ephemeral: true,
        });

        return;
    }

    const banshare = await db.banshares.findOne({
        message: post.banshare,
    });

    if (!banshare) {
        await interaction.reply({
            content: "This banshare is missing from the database.",
            ephemeral: true,
        });

        return;
    }

    if (banshare.rescinded) {
        await interaction.reply({
            content:
                "This banshare has been rescinded. You may still ban these users manually at your own judgement.",
            ephemeral: true,
        });

        return;
    }

    return banshare;
}

async function execute(
    banshare: any,
    settings: any,
    guild: Guild,
    message: Message,
    executor?: User
) {
    const mod = executor ? { mod: executor.id } : {};

    const missed: string[] = [];
    const banned: User[] = [];
    const failed: User[] = [];

    for (const id of banshare.id_list as string[]) {
        let user: User;

        try {
            user = await bot.users.fetch(id);
        } catch {
            missed.push(id);
            continue;
        }

        try {
            await guild.bans.create(id);
            banned.push(user);

            if (settings?.daedalus) {
                try {
                    const response = await fetch(
                        `${PUBLIC_DDL_API}/moderation/history/${guild.id}/user/${id}`,
                        {
                            method: "post",
                            headers: {
                                Authorization: `Bearer ${DDL_TOKEN}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                type: "ban",
                                duration: 0,
                                origin: message.url,
                                reason:
                                    "TCN Banshare: " +
                                    (banshare.reason ?? "(missing reason)"),
                                ...mod,
                            }),
                        }
                    );

                    if (!response.ok)
                        console.error(response.status, await response.json());
                } catch (error) {
                    console.error(error);
                }
            }
        } catch {
            failed.push(user);
        }
    }

    const entry = await db.logging.findOne({ guild: guild.id });

    if (entry) {
        try {
            const channel = await bot.channels.fetch(entry.channel);
            if (!channel?.isTextBased()) throw 0;

            const prefix = `Banshare Executed; banned ${banned.length} user${
                banned.length === 1 ? "" : "s"
            }.\nOrigin: ${message.url}\nReasion: ${banshare.reason}`;

            try {
                await channel.send(
                    `${prefix}\nSuccess: ${
                        banned.join(", ") || "(none)"
                    }\nFailed: ${failed.join(", ") || "(none)"}\nInvalid IDs: ${
                        missed.join(", ") || "(none)"
                    }`
                );
            } catch {
                await channel.send({
                    content: prefix,
                    files: [
                        {
                            attachment: Buffer.from(
                                `Success: ${
                                    banned
                                        .map((x) => `${x.tag} (${x.id})`)
                                        .join(", ") || "(none)"
                                }\nFailed: ${
                                    failed
                                        .map((x) => `${x.tag} (${x.id})`)
                                        .join(", ") || "(none)"
                                }\nInvalid IDs: ${
                                    missed.join(", ") || "(none)"
                                }`,
                                "utf-8"
                            ),
                            name: "banshare.txt",
                        },
                    ],
                });
            }
        } catch {}
    }
}

async function save(banshare: any, guild: string, post: Message) {
    await db.banshare_posts.insertOne({
        guild,
        banshare: banshare.value.message,
        channel: post.channel.id,
        message: post.id,
    });
}

async function get_post(banshare: any, guild: string) {
    const entry = await db.banshare_posts.findOne({
        guild,
        banshare: banshare.value.message,
    });

    if (!entry) return;

    try {
        const channel = await bot.channels.fetch(entry.channel);
        if (!channel?.isTextBased()) return;
        return await channel.messages.fetch(entry.message);
    } catch {}
}

const thresholds = { all: 0, med: 1, crit: 2, none: 3 } as any;
const severities = { low: 0, medium: 1, critical: 2 } as any;

function autoban(threshold: string, severity: string) {
    return (
        (thresholds[threshold] ?? Infinity) <=
        (severities[severity] ?? -Infinity)
    );
}

function confirm(disabled: boolean = false, suffix: string = ""): any[] {
    return [
        {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Success,
                    customId: `confirm${suffix}`,
                    label: "Confirm",
                    disabled,
                },
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Danger,
                    customId: `cancel${suffix}`,
                    label: "Cancel",
                    disabled,
                },
            ],
        },
    ];
}

async function allowed(guild: Guild) {
    if (PUBLIC_ALLOWLIST && PUBLIC_ALLOWLIST.indexOf(guild.id) >= 0)
        return true;

    const request = await fetch(`${PUBLIC_TCN_API}/guilds/${guild.id}`);

    if (!request.ok) return false;
    return true;
}

await bot.login(TOKEN);
export default bot;
