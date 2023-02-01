<script lang="ts">
    import { PUBLIC_TCN_API } from "$env/static/public";
    import {
        Collapsable,
        LoadingSpinner,
        Modal,
        SaveChanges,
    } from "@daedalus-discord/webkit";
    import { onMount } from "svelte";

    export let data: any;

    let error: string;
    let save_error: string;
    let settings: any;
    let servers: [string, string][];

    let open: Record<string, boolean> = {};

    let saved: string = "";

    onMount(async () => {
        const tcn_request = await fetch(`${PUBLIC_TCN_API}/guilds`);

        if (!tcn_request.ok) return (error = "TCN API is offline.");

        servers = ((await tcn_request.json()) as { id: string; name: string }[])
            .map(
                (server) => [server.id, server.name] satisfies [string, string]
            )
            .sort(([, a], [, b]) => a.localeCompare(b));

        const request = await fetch(`/settings?gid=${data.gid}`);

        const response = await request.json();
        if (response.error) return (error = response.error);

        response.button ??= false;
        response.daedalus ??= false;
        response.autoban ??= "none";

        saved = JSON.stringify((settings = response));
    });

    let unsaved: boolean = false;
    $: unsaved = settings && JSON.stringify(settings) !== saved;

    let saving: boolean = false;

    async function save() {
        save_error = "";
        saving = true;

        const request = await fetch(`/settings?gid=${data.gid}`, {
            method: "post",
            body: JSON.stringify(settings),
        });

        const response = await request.json();
        if (response.error)
            return (save_error = response.error), (saving = false);

        saved = JSON.stringify(settings);
        saving = false;
    }

    function reset() {
        settings = JSON.parse(saved);
    }
</script>

<div class="container" style="padding-top: 20px">
    <br />
    {#if error}
        <div class="error">{error}</div>
        <br />
    {:else if !settings}
        <div class="row">
            <LoadingSpinner size={50} text="" />
            <b>Loading server settings...</b>
        </div>
        <br />
    {/if}

    <a href="/">Back to Home Page</a>

    {#if !error && settings}
        <br />
        <br />
        {#if save_error}
            <div class="error">{save_error}</div>
        {/if}
        <div class="glass">
            <h3>Base Settings</h3>
            <label>
                <input type="checkbox" bind:checked={settings.button} />
                Enable Ban Button
                <a
                    href={"javascript:void(0)"}
                    on:click={() => (open.ban_button = true)}>[?]</a
                >
            </label>
            <br />
            <label>
                <input type="checkbox" bind:checked={settings.daedalus} />
                Enable Daedalus Integration
                <a
                    href={"javascript:void(0)"}
                    on:click={() => (open.daedalus = true)}>[?]</a
                >
            </label>
            <br />
            <br />
            To set the banshare output channel, use <b>/banshare post here</b>
            in the channel. To set the log channel (your mod logs), use
            <b>/banshare log here</b> in the channel.
        </div>
        <div class="glass">
            <h3>Auto-Ban Settings</h3>
            <Collapsable
                title="<b>Information</b>"
                header_color="white"
                color="rgb(var(--darker))"
            >
                <p>
                    There are three severities of banshares: low, medium, and
                    critical. There is no formal definition for each type, but
                    the guidelines are as follows:
                </p>
                <ul>
                    <li>
                        <b>Low</b> &mdash; e.g. user causing a bit of trouble
                    </li>
                    <li><b>Medium</b> &mdash; e.g. low-threat scam bots</li>
                    <li>
                        <b>Critical</b> &mdash; e.g. raids, harassment, etc.
                    </li>
                </ul>
                <p>
                    You can configure automatic banning at four different levels
                    &mdash; all, medium and above, critical only, and none.
                </p>
            </Collapsable>
            <h4>Autoban Threshold</h4>
            <select bind:value={settings.autoban}>
                <option value="all">All</option>
                <option value="med">Medium And Above</option>
                <option value="crit">Critical Only</option>
                <option value="none">None</option>
            </select>
        </div>
    {/if}

    <Modal bind:open={open.ban_button} background_color="rgb(var(--darkest))">
        This button will allow users with the <b>Ban Members</b> permission to execute
        banshares with the press of a button.
    </Modal>

    <Modal bind:open={open.daedalus} background_color="rgb(var(--darkest))">
        If this setting is enabled, bans executed by the bot will be added into
        your Daedalus user history (if it was done via the ban button, it will
        show the mod who clicked it, and if it was done through auto-banning, it
        will show <b>TCN Banshares</b> as the executor)
    </Modal>

    <SaveChanges
        {unsaved}
        {saving}
        on:save={save}
        on:reset={reset}
        background="#111"
    />
</div>
