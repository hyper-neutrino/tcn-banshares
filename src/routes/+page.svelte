<script lang="ts">
    import { PUBLIC_TCN_API } from "$env/static/public";
    import { LoadingSpinner, Modal, Textarea } from "@daedalus-discord/webkit";
    import { onMount } from "svelte";
    import { escape } from "svelte/internal";

    export let data: any;
    export let form: any;

    let servers: [string, string][] | undefined;

    onMount(async () => {
        if (!data.user) return;

        const [user_data, guilds_data] = await Promise.all(
            [
                `${PUBLIC_TCN_API}/users/${data.user.id}`,
                `${PUBLIC_TCN_API}/guilds`,
            ].map(async (url) => {
                const response = await fetch(url);
                if (!response.ok) return {};
                return await response.json();
            })
        );

        const map = new Map<string, string>();
        for (const guild of guilds_data) map.set(guild.id, guild.name);

        const output: [string, string][] = [];

        for (const guild of user_data?.guilds ?? [])
            if (map.has(guild)) output.push([guild, map.get(guild) as string]);

        servers = output;
    });

    let ids: string = form?.ids ?? "";

    let y: number = 0;
    let open: boolean = false;
    let error: string | undefined;
    let tag_list: string[] | undefined;

    let session: string = crypto.randomUUID();

    let last: string = "";

    function check_ids() {
        const list = ids.trim().split(/\s+/);
        const cmp = JSON.stringify(list);

        if (cmp === last) return (open = true);
        last = cmp;

        tag_list = error = undefined;
        open = true;

        for (const id of list)
            if (!id.match(/^[1-9][0-9]{16,19}$/))
                return (error = `Invalid ID: <code>${escape(
                    id
                )}</code> is not a valid Discord ID.`);

        fetch(`/fetch?session=${session}`, {
            method: "post",
            body: JSON.stringify(list),
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.error) error = data.error;
                else tag_list = data;
            });
    }

    function close_modal() {
        if (!error && !tag_list) fetch(`/abort?session=${session}`);
    }
</script>

<svelte:window
    bind:scrollY={y}
    on:keydown={(e) =>
        e.key === "Enter" &&
        e.ctrlKey &&
        document.querySelector("form")?.requestSubmit()}
/>

<div
    id="header"
    style="padding: {Math.max(0, 2 - y / 50)}em 0; --opacity: {Math.min(
        100,
        y
    )}%"
>
    <div class="container row">
        <img
            alt="TCN Icon"
            src="/favicon.png"
            width="{Math.max(50, 100 - y)}px"
        />
        <h1 style="padding-left: 0.5em">TCN Banshare Form</h1>
    </div>
</div>
<div id="main" class="container">
    <div class="glass">
        Logged in as <b>{data.user.username}</b><span style="opacity: 40%"
            >#{data.user.discriminator}</span
        >. Not you? <a href="/auth/logout">Log Out</a>
        <br />
        <a href="/manage">Manage settings for your servers</a>
    </div>
    {#if servers?.length === 0}
        <div class="error">
            You are not staff on any TCN servers. If you believe this is a
            mistake, contact your server's owner or a TCN observer.
        </div>
    {:else}
        {#if form?.error}
            <div class="error">{@html form.error}</div>
        {:else if form?.success}
            <div class="success">Your banshare has been submitted.</div>
        {/if}
        <form method="post">
            <div class="glass">
                <h3>ID(s) of the offender(s)</h3>
                <input
                    type="text"
                    name="ids"
                    placeholder="Space-separated list of IDs"
                    on:keydown={(e) => e.key === "Enter" && e.preventDefault()}
                    required
                    autocomplete="off"
                    bind:value={ids}
                />
                {#if ids.trim() !== ""}
                    <div>
                        <br />
                        <button type="button" on:click={check_ids}>
                            Check IDs
                        </button>
                        (shows the users' tags if all IDs are valid)
                    </div>
                {/if}
                <h3>Reason</h3>
                <p>
                    If you need more than 498 characters, you should probably be
                    putting it into the evidence field instead.
                </p>
                <Textarea
                    name="reason"
                    placeholder="Tip: make the reason something suitable for an audit log reason for the ban. Include context in the next field."
                    min_height="5em"
                    maxlength={498}
                    required
                    autocomplete="off"
                    value={form?.reason}
                />
                <h3>Evidence</h3>
                <p>
                    For images, use Imgur or a similar service. Discord hosted
                    image links work too, but keep in mind that deleting the
                    message containing the image will eventually cause the image
                    link to break.
                </p>
                <p>
                    If you need more than 1000 characters, please create a
                    document and link it here. Include some basic information in
                    the evidence so people can see roughly what your document
                    contains.
                </p>
                <p>
                    Please spoiler anything suggestive and break up any image
                    links to explicit / triggering content so people can't
                    accidentally access them.
                </p>
                <Textarea
                    name="evidence"
                    placeholder="Provide sufficient evidence to verify your reason and for other mods to make an informed decision."
                    min_height="5em"
                    required
                    maxlength={1200}
                    autocomplete="off"
                    value={form?.evidence}
                />
            </div>
            <div class="glass">
                <h3>Server</h3>
                <p>Identify which server you are bansharing this from.</p>
                {#if !servers}
                    <LoadingSpinner
                        size={25}
                        foreground="#fff"
                        background="#fff8"
                        text="Loading Servers"
                    />
                {:else}
                    <select name="server" required>
                        <option
                            selected={servers.length > 1}
                            disabled
                            hidden
                            value=""
                        >
                            Select Server
                        </option>
                        {#each servers as [id, name]}
                            <option
                                value={id}
                                selected={servers.length === 1 ||
                                    form?.server === id}>{name}</option
                            >
                        {/each}
                    </select>
                {/if}
            </div>
            <div class="glass">
                <h3>Severity</h3>
                <p>The severity is used to determine auto-banning.</p>
                <ul>
                    <li>
                        <b>Low</b> &mdash; e.g. user causing a bit of trouble
                    </li>
                    <li><b>Medium</b> &mdash; e.g. low-threat scam bots</li>
                    <li>
                        <b>Critical</b> &mdash; e.g. raids, harassment, etc.
                    </li>
                </ul>
                <select name="severity" required>
                    <option selected disabled hidden value="">
                        Select Severity
                    </option>
                    {#each ["Low", "Medium", "Critical"] as sev}
                        <option
                            value={sev.toLowerCase()}
                            selected={form?.severity === sev.toLowerCase()}
                        >
                            {sev}
                        </option>
                    {/each}
                </select>
            </div>
            <div class="glass">
                <h3>Urgency</h3>
                <p>
                    Check the box below to instruct the bot to ping all
                    observers instead of just a few to review this.
                </p>
                <label>
                    <input
                        type="checkbox"
                        name="urgent"
                        checked={form?.urgent}
                    />
                    <b>This banshare is urgent.</b>
                </label>
            </div>
            <div class="glass">
                <input
                    type="submit"
                    name="submit"
                    value="Submit"
                    style="font-weight: bold"
                />
                <input
                    type="submit"
                    name="submit"
                    value="Submit Without Checking IDs"
                />
                <br />
                <br />
                <b>WARNING:</b> You should only submit without checking IDs if
                your ID list is a link instead of an actual list of IDs. Doing
                this will also prevent automatic banning. Consider just pasting
                your entire ID list instead if possible - the bot will collapse
                it into a document link if it's too long.
                <br />
                <br />
                <b>This may take some time</b> if you have submitted a long ID list,
                as the bot needs time to fetch all of the users.
            </div>
        </form>
    {/if}
</div>
<div id="spacer" />

<Modal bind:open background_color="rgb(var(--darkest))" on:close={close_modal}>
    {#if error}
        <div class="error">
            {@html error}
        </div>
    {:else if tag_list}
        <b>You will be bansharing:</b>
        <ul>
            {#each tag_list as [tag, id]}
                <li>{tag} &mdash; <code>{id}</code></li>
            {/each}
        </ul>
    {:else}
        <div class="row">
            <LoadingSpinner size={50} text="" />
            <b>Loading users...</b>
        </div>
    {/if}
</Modal>

<style lang="scss">
    #header {
        position: fixed;
        top: 0;
        left: 0;

        background-color: rgb(var(--extra-dark), var(--opacity));
        width: 100%;
    }

    #main {
        padding-top: 150px;
    }

    h3 {
        margin: 1em 0 0.5em 0;
        padding: 0;
    }

    #spacer {
        height: calc(min(40vh, 40vw));
    }
</style>
