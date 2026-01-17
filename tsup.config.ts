/// <reference types="node" />
import { log } from "node:console";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const __dirname = dirname(fileURLToPath(import.meta.url));

function checkBotImports() {
  const botDir = join(__dirname, "src/bot");

  const getFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      return statSync(p).isDirectory()
        ? getFiles(p)
        : e.endsWith(".ts") && e !== "index.ts"
          ? [`./${relative(botDir, p).replace(/\.ts$/, "")}`]
          : [];
    });

  const expected = [
    ...getFiles(join(botDir, "commands")),
    ...getFiles(join(botDir, "events")),
  ];

  const actual = readFileSync(join(botDir, "index.ts"), "utf-8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .map((l) => l.match(/^import\s+["']([^"']+)["']/)?.[1])
    .filter(Boolean) as string[];

  const missing = expected.filter((i) => !actual.includes(i));
  const extra = actual.filter((i) => !expected.includes(i));

  if (missing.length || extra.length) {
    if (missing.length) console.error("Missing:", missing.join(", "));
    if (extra.length) console.error("Stale:", extra.join(", "));
    throw new Error("Bot imports check failed");
  }
  log("Bot imports verified.");
}

checkBotImports();

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  external: ["@dotenvx/dotenvx", "dayjs"],
  splitting: false,
});
