<script lang="ts">
    import { Redirect } from "@daedalus-discord/webkit";

    export let data: any;
</script>

<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <link rel="shortcut icon" type="image/png" href="/favicon.png" />
        <link rel="stylesheet" type="text/css" href="/styles/stylesheet.css" />
        <link
            rel="stylesheet"
            type="text/css"
            href="https://fonts.googleapis.com/icon?family=Material+Icons"
        />

        <title>TCN Banshares</title>
    </head>

    <body>
        {#if !data.user}
            <Redirect to="/auth/login" />
        {:else}
            <slot />
        {/if}
    </body>
</html>
