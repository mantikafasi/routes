setInterval(async () => {
    await Bun.$`bun run src/index.ts`;
}, 1000 * 60 * 5); // 5 minutes

await Bun.$`bun run src/index.ts`