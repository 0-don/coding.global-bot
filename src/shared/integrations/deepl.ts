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

  const length = text.split(" ").length;
  if (length < 4) {
    return "Please add 5 or more words to translate.";
  }
  const translated = await TRANSLATOR?.translateText(text, null, "en-GB");
  return translated?.text;
};
