import * as deepl from "deepl-node";
import { ConfigValidator } from "@/shared/config/validator";

export const TRANSLATOR = ConfigValidator.isFeatureEnabled("DEEPL")
  ? new deepl.Translator(process.env.DEEPL!)
  : null;

export const translate = async (text: string) => {
  if (!ConfigValidator.isFeatureEnabled("DEEPL")) {
    ConfigValidator.logFeatureDisabled("Translation", "DEEPL");
    return;
  }

  const translated = await TRANSLATOR?.translateText(text, null, "en-GB");
  if (!translated?.text || translated.detectedSourceLang.toUpperCase() === "EN") {
    return;
  }
  return translated.text;
};
