/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const __dirname = dirname(fileURLToPath(import.meta.url));

function checkBotImports() {
  const botDir = join(__dirname, "src/bot");
  const indexPath = join(botDir, "index.ts");

  function getFilesRecursively(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        files.push(...getFilesRecursively(fullPath));
      } else if (entry.endsWith(".ts") && entry !== "index.ts") {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allFiles = [
    ...getFilesRecursively(join(botDir, "commands")),
    ...getFilesRecursively(join(botDir, "events")),
  ];

  const expectedImports = allFiles.map((f) => {
    const rel = relative(botDir, f).replace(/\.ts$/, "");
    return `./${rel}`;
  });

  const indexContent = readFileSync(indexPath, "utf-8");
  const importRegex = /import\s+["']([^"']+)["']/g;
  const actualImports: string[] = [];
  let match;
  while ((match = importRegex.exec(indexContent)) !== null) {
    actualImports.push(match[1]);
  }

  const missing = expectedImports.filter((i) => !actualImports.includes(i));
  const extra = actualImports.filter((i) => !expectedImports.includes(i));

  if (missing.length > 0) {
    console.error("Missing imports in src/bot/index.ts:");
    missing.forEach((i) => console.error(`  import "${i}";`));
  }
  if (extra.length > 0) {
    console.error("Stale imports in src/bot/index.ts (files not found):");
    extra.forEach((i) => console.error(`  ${i}`));
  }
  if (missing.length > 0 || extra.length > 0) {
    throw new Error("Bot imports check failed");
  }
  console.log("Bot imports verified.");
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
