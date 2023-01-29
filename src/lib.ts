import { ButtonStyle, ComponentType } from "discord.js";

export function components(published: boolean, severity?: string): any[] {
    if (published)
        return [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Danger,
                        customId: "rescind",
                        label: "Rescind",
                    },
                ],
            },
        ];

    return [
        {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Secondary,
                    customId: "sev:low",
                    label: "SEV: Low",
                    disabled: severity === "low",
                },
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    customId: "sev:medium",
                    label: "SEV: Medium",
                    disabled: severity === "medium",
                },
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Danger,
                    customId: "sev:critical",
                    label: "SEV: Critical",
                    disabled: severity === "critical",
                },
            ],
        },
        {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Success,
                    customId: "publish",
                    label: "PUBLISH",
                },
            ],
        },
    ];
}
