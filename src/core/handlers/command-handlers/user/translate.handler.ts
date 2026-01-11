import { ConfigValidator } from "@/shared/config/validator";
import { translate } from "@/shared/integrations/deepl";

export type TranslateCommandResult = { text: string } | { error: string };

export async function executeTranslateCommand(
  text: string,
): Promise<TranslateCommandResult> {
  if (!ConfigValidator.isFeatureEnabled("DEEPL")) {
    ConfigValidator.logFeatureDisabled("Translation", "DEEPL");
    return {
      error:
        "Translation feature is not configured. Please contact an administrator.",
    };
  }

  const cleanText = Buffer.from(text, "utf-8").toString();
  const translatedText = await translate(cleanText);

  return { text: translatedText ?? cleanText };
}
