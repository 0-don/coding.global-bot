import { log, warn } from "console";

interface ConfigCheck {
  key: keyof FeatureBotEnvironment;
  required: boolean;
  feature: string;
}

export class ConfigValidator {
  private static checks: ConfigCheck[] = [
    {
      key: "DEEPL",
      required: false,
      feature: "Translation",
    },
    {
      key: "GOOGLE_GENERATIVE_AI_API_KEY",
      required: false,
      feature: "AI Chat & Spam Detection",
    },
    {
      key: "TENOR_API_KEY",
      required: false,
      feature: "GIF Search",
    },
    {
      key: "HELPER_ROLES",
      required: false,
      feature: "Helper Role System",
    },
    {
      key: "STATUS_ROLES",
      required: false,
      feature: "Status Role Management",
    },
    {
      key: "LEVEL_ROLES",
      required: false,
      feature: "Level Up System",
    },
    {
      key: "BOT_CHANNELS",
      required: false,
      feature: "Bot Channel Restrictions",
    },
    {
      key: "VERIFY_CHANNELS",
      required: false,
      feature: "Verification System",
    },
    {
      key: "VOICE_EVENT_CHANNELS",
      required: false,
      feature: "Voice Event Logging",
    },
    {
      key: "JOIN_EVENT_CHANNELS",
      required: false,
      feature: "Join/Leave Event Logging",
    },
    {
      key: "MEMBERS_COUNT_CHANNELS",
      required: false,
      feature: "Member Count Display",
    },
    {
      key: "SHOULD_USER_LEVEL_UP",
      required: false,
      feature: "Level Up System",
    },
    {
      key: "SHOULD_LOG_VOICE_EVENTS",
      required: false,
      feature: "Voice Event Logging",
    },
    {
      key: "SHOULD_COUNT_MEMBERS",
      required: false,
      feature: "Member Count Updates",
    },
    {
      key: "IS_CONSTRAINED_TO_BOT_CHANNEL",
      required: false,
      feature: "Bot Channel Restrictions",
    },
    {
      key: "BOT_ICON",
      required: false,
      feature: "Custom Bot Icon",
    },
  ];

  public static validateConfig(): void {
    log("🔧 Checking bot configuration...");

    const missing = this.checks.filter((check) => {
      const value = process.env[check.key];
      return !value || value.trim() === "";
    });

    const configured = this.checks.filter((check) => {
      const value = process.env[check.key];
      return value && value.trim() !== "";
    });

    if (configured.length > 0) {
      log("✅ Configured features:");
      configured.forEach((check) => log(`   - ${check.feature}`));
    }

    if (missing.length > 0) {
      warn("⚠️  Features disabled due to missing configuration:");
      missing.forEach((check) => {
        warn(`   - ${check.feature} (missing ${check.key})`);
      });
      warn("   Check your .env file to enable these features.");
    }

    log(
      `📊 Configuration: ${configured.length}/${this.checks.length} features enabled\n`,
    );
  }

  public static isFeatureEnabled(envKey: keyof FeatureBotEnvironment): boolean {
    const value = process.env[envKey];
    return !!(value && value.trim() !== "");
  }

  public static logFeatureDisabled(
    feature: string,
    envKey: keyof FeatureBotEnvironment,
  ): void {
    warn(`⚠️  ${feature} disabled: ${envKey} not configured`);
  }
}
