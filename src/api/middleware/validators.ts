import { t } from "elysia";

export const BoardType = t.Union([
  // Marketplace & Showcase
  t.Literal("job-board"),
  t.Literal("dev-board"),
  t.Literal("showcase"),
  // Programming language channels
  t.Literal("cpp"),
  t.Literal("csharp"),
  t.Literal("c"),
  t.Literal("dart"),
  t.Literal("lua"),
  t.Literal("go"),
  t.Literal("html-css"),
  t.Literal("java"),
  t.Literal("javascript"),
  t.Literal("kotlin"),
  t.Literal("python"),
  t.Literal("rust"),
  t.Literal("php"),
  t.Literal("bash-powershell"),
  t.Literal("sql"),
  t.Literal("swift"),
  t.Literal("visual-basic"),
  t.Literal("zig"),
  t.Literal("other"),
]);

export const ThreadParams = t.Object({
  guildId: t.String(),
  boardType: BoardType,
  threadId: t.String(),
});
