import { defineConfig } from "tsup";
import { copyFileSync } from "fs";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["@dotenvx/dotenvx", "dayjs"],
  onSuccess: async () => {
    // Copy yaml prompt files to dist (same level as main.js since __dirname = dist)
    copyFileSync("src/shared/config/prompts/chat.yaml", "dist/chat.yaml");
    copyFileSync("src/shared/config/prompts/spam.yaml", "dist/spam.yaml");
  },
});
