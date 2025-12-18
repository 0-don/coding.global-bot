// @ts-check

/** @type {import('dts-bundle-generator/config-schema').BundlerConfig} */
const config = {
  entries: [
    {
      filePath: "./src/elysia.ts",
      outFile: "./dist/elysia.d.ts",
      noCheck: true,
      libraries: {
        inlinedLibraries: ["discord.js"],
      },
    },
  ],
};

module.exports = config;
