import { GIST_TOKEN } from "$env/static/private";
import { Octokit } from "octokit";

const octokit = new Octokit({ auth: GIST_TOKEN });

export async function create_gist(
    filename: string,
    description: string,
    content: string
) {
    const request = await octokit.request("POST /gists", {
        description,
        files: { [filename]: { content } },
    });

    if (request.status !== 201) throw "Error creating gist.";
    return request.data.html_url as string;
}
