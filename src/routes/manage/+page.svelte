<script lang="ts">
    import { PUBLIC_DIS_API, PUBLIC_TCN_API } from "$env/static/public";
    import { LoadingSpinner } from "@daedalus-discord/webkit";
    import { onMount } from "svelte";

    export let data: any;

    let error: string;
    let servers: { name: string; id: string }[];

    onMount(async () => {
        try {
            const [tcn_request, discord_request] = await Promise.all([
                fetch(`${PUBLIC_TCN_API}/guilds`),
                fetch(`${PUBLIC_DIS_API}/users/@me/guilds`, {
                    headers: { Authorization: `Bearer ${data.access_token}` },
                }),
            ]);

            if (!tcn_request.ok) error = "The TCN API appears to be offline.";
            if (!discord_request.ok)
                error = "Discord API error. Please try logging in again.";

            const tcn_servers = (await tcn_request.json())
                .map((server: { id: string }) => server.id)
                .concat(["927153548339343360"]);

            servers = (await discord_request.json()).filter(
                (server: { id: string; permissions: number }) =>
                    server.permissions & 8 && tcn_servers.includes(server.id)
            );
        } catch {
            error =
                "Fetching data from either Discord or the TCN API failed. Please try again later.";
        }
    });
</script>

<div class="container" style="padding-top: 20px">
    {#if !servers}
        <div class="row">
            <LoadingSpinner size={50} text="" />
            <b>Loading servers...</b>
        </div>
    {:else if error || servers.length === 0}
        <div class="error">
            {#if error}
                {error}
            {:else}
                You are not an admin of any TCN servers.
            {/if}
        </div>
    {:else}
        <ul>
            {#each servers.sort( (a, b) => a.name.localeCompare(b.name) ) as server}
                <li><a href="/manage/{server.id}">{server.name}</a></li>
            {/each}
        </ul>
    {/if}
    <br />
    <a href="/">Back to Home Page</a>
</div>
