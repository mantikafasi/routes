import path from "path";
import downloader from "./utils/downloader.ts";
import { Config } from "./utils/defineConfig.ts";
import cleaner from "./utils/cleaner.ts";
import walk from "./utils/walk.ts";

if (!(await Bun.file(path.join(import.meta.dirname, "./config.ts")).exists())) {
    console.log("Config file not found, we've created one for you. Please fill it out and restart.")

    await Bun.write(path.join(import.meta.dirname, "./config.ts"), `import { defineConfig } from "./utils/defineConfig.ts";

export default defineConfig({
    webhooks: [],
    githubToken: "",
    listenForChanges: true,
    repo: {
        owner: "Discord-Datamining",
        name: "Discord-Datamining",
        branch: "head/master",
        postComments: false
    },
    downloadPath: "https://raw.githubusercontent.com/Darker-Ink/endpoint-downloader/master/currentRoutes.js"
})`)

    process.exit(1);
}

interface EndpointType {
    firstSeen: number;
    args: string[] | string[][];
    paths: string[];
    oldPaths: {
        paths: string;
        args: string;
        changedAt: number;
    }[];
}

const config = (await import(path.join(import.meta.dirname, "./config.ts"))).default as Config
const downloaded = await downloader(config.config.downloadPath);
const cleaned = await cleaner(downloaded);
const walked = await walk(cleaned);

const currentEndpoints: {
    endpoints: Record<string, EndpointType>,
    routes: Record<string, EndpointType>
} = await Bun.file("endpoints.json").exists() ? await Bun.file("endpoints.json").json() : {
    endpoints: {},
    routes: {}
};

const diffEndpoints = (oldEndpoints: {
    endpoints: Record<string, EndpointType>,
    routes: Record<string, EndpointType>
}, newEndpoints: {
    endpoints: Record<string, EndpointType>,
    routes: Record<string, EndpointType>
}): { endpointsDiff: string, routesDiff: string } => {
    const compare = (oldData: Record<string, EndpointType>, newData: Record<string, EndpointType>) => {
        let diff: {
            added: { key: string, path: string }[],
            modified: { key: string, old: EndpointType, new: EndpointType }[],
            removed: { key: string, path: string }[]
        } = {
            added: [],
            modified: [],
            removed: []
        }

        for (const key in newData) {
            if (!oldData[key]) {
                newData[key].paths.forEach(path => {
                    diff.added.push({ key, path });
                });
            } else if (
                JSON.stringify(oldData[key].paths) !== JSON.stringify(newData[key].paths) ||
                JSON.stringify(oldData[key].args) !== JSON.stringify(newData[key].args)
            ) {
                diff.modified.push({ key, old: oldData[key], new: newData[key] });
            }
        }

        for (const key in oldData) {
            if (!newData[key]) {
                oldData[key].paths.forEach(path => {
                    diff.removed.push({ key, path });
                });
            }
        }

        let output = "";

        if (diff.added.length) {
            output += "# Added\n\n\`\`\`diff\n";
            diff.added.forEach(({ key, path }) => {
                output += `+ ${key}: ${path}\n`;
            });
            output += "\n\`\`\`\n";
        }

        if (diff.modified.length) {
            output += "# Modified\n\n\`\`\`diff\n";
            diff.modified.forEach(({ key, old, new: n }) => {
                output += `- ${key}: ${old.paths.join(", ")}\n`;
                output += `+ ${key}: ${n.paths.join(", ")}\n`;
            });
            output += "\n\`\`\`\n";
        }

        if (diff.removed.length) {
            output += "# Removed\n\n\`\`\`diff\n";
            diff.removed.forEach(({ key, path }) => {
                output += `- ${key}: ${path}\n`;
            });
            output += "\n\`\`\`\n";
        }

        return output;
    };

    return {
        endpointsDiff: compare(oldEndpoints.endpoints, newEndpoints.endpoints),
        routesDiff: compare(oldEndpoints.routes, newEndpoints.routes)
    }
};

const { endpointsDiff, routesDiff } = diffEndpoints(currentEndpoints, walked);

const fixedEndpoints: {
    endpoints: Record<string, EndpointType>,
    routes: Record<string, EndpointType>
} = {
    endpoints: currentEndpoints.endpoints,
    routes: currentEndpoints.routes
};

for (const key in walked.endpoints) {
    if (fixedEndpoints.endpoints[key]) {
        if (JSON.stringify(fixedEndpoints.endpoints[key].paths) !== JSON.stringify(walked.endpoints[key].paths)) {
            fixedEndpoints.endpoints[key].oldPaths.push({
                paths: fixedEndpoints.endpoints[key].paths.join(", "),
                args: fixedEndpoints.endpoints[key].args.join(", "),
                changedAt: Date.now()
            });

            fixedEndpoints.endpoints[key].paths = walked.endpoints[key].paths;
            fixedEndpoints.endpoints[key].args = walked.endpoints[key].args;
        }
    } else {
        fixedEndpoints.endpoints[key] = walked.endpoints[key];
    }
}

for (const key in walked.routes) {
    if (fixedEndpoints.routes[key]) {
        if (JSON.stringify(fixedEndpoints.routes[key].paths) !== JSON.stringify(walked.routes[key].paths)) {
            fixedEndpoints.routes[key].oldPaths.push({
                paths: fixedEndpoints.routes[key].paths.join(", "),
                args: fixedEndpoints.routes[key].args.join(", "),
                changedAt: Date.now()
            });

            fixedEndpoints.routes[key].paths = walked.routes[key].paths;
            fixedEndpoints.routes[key].args = walked.routes[key].args;
        }
    } else {
        fixedEndpoints.routes[key] = walked.routes[key];
    }
}


if (endpointsDiff || routesDiff) {
    const endpointDiffEmbed = {
        type: "rich",
        title: "Endpoints modified!",
        description: `${endpointsDiff}`,
        color: 0x00FF00, // green
        timestamp: new Date().toISOString(),
        footer: {
            text: "Anything marked as :arg is an unknown argument"
        }
    }

    const routeDiffEmbed = {
        type: "rich",
        title: "Routes modified!",
        description: `${routesDiff}`,
        color: 0x00FF00, // green
        timestamp: new Date().toISOString(),
        footer: {
            text: "Anything marked as :arg is an unknown argument"
        }
    }

    if (config.config.webhooks.length) {
        for (const webhook of config.config.webhooks) {
            if (webhook.enabled) {
                await fetch(webhook.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        content: webhook.customMessage,
                        embeds: [
                            endpointsDiff ? endpointDiffEmbed : null,
                            routesDiff ? routeDiffEmbed : null
                        ].filter(e => e !== null)
                    })
                });
            }
        }
    }

    console.log("Changes detected, sending webhooks and updating endpoints.json");
}

await Bun.write("endpoints.json", JSON.stringify(fixedEndpoints, null, 4));

await Bun.$`git add endpoints.json`;
await Bun.$`git commit -m "Updated endpoints.json"`;
await Bun.$`git push`;


console.log("Finished downloading and parsing endpoints!")