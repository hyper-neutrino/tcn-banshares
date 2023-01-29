<script lang="ts">
    import { page } from "$app/stores";
</script>

<div class="container">
    <br />
    <br />
    <div class="glass">
        <br />
        <span style="font-size: 200%">
            <b>{$page.status}</b>
            {$page.error?.message ?? "Unknown Error"}
        </span>
        <br />
        <br />
        <a href="/">Return to Home Page</a>
    </div>
</div>
