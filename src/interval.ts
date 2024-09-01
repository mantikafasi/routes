setInterval(async () => {
    await Bun.$`bun run src/index.ts`;
}, 5000)

await Bun.$`bun run src/index.ts`