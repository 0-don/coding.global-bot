import { ModelMessage } from "ai";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Collection, Message, StickerFormatType } from "discord.js";
import { gatherChannelContext, searchMemeGifs } from "./tools";

dayjs.extend(relativeTime);

export const channelMessages = new Map<string, ModelMessage[]>();
export const MAX_MESSAGES_PER_CHANNEL = 20;
export const CODING_GLOBAL_PATTERN = /^coding\s?global/i;
export const TOOLS = { searchMemeGifs, gatherChannelContext };

export async function gatherMessageContext(
  repliedMessage: Message<boolean>
): Promise<{
  context: string;
  images: string[];
}> {
  const userId = repliedMessage.author.id;
  const channel = repliedMessage.channel;
  const images: string[] = [];

  try {
    const [recentMessages, afterMessages] = await Promise.all([
      channel.messages.fetch({ limit: 50, before: repliedMessage.id }),
      channel.messages.fetch({ limit: 50, after: repliedMessage.id }),
    ]);

    const getUserMessages = (messages: Collection<string, Message>) =>
      Array.from(messages.values())
        .filter((msg) => msg.author.id === userId && !msg.author.bot)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const beforeArray = getUserMessages(recentMessages).reverse();
    const afterArray = getUserMessages(afterMessages);

    const getConsecutiveMessages = (messages: Message[]): Message[] => {
      const result: Message[] = [];
      for (const msg of messages) {
        if (msg.author.id === userId) {
          result.push(msg);
        } else break;
      }
      return result;
    };

    const messagesBefore = getConsecutiveMessages(beforeArray);
    const messagesAfter = getConsecutiveMessages(afterArray);
    const allMessages = [...messagesBefore, repliedMessage, ...messagesAfter];

    const contextParts = await Promise.all(
      allMessages.map(async (msg) => {
        let content = msg.content?.trim() || "";

        if (msg.attachments.size > 0) {
          try {
            const msgImages = await makeImageParts(msg);
            images.push(...msgImages);

            // Extract code from attachments
            const codeContent = await extractCodeFromAttachments(msg);
            if (codeContent) {
              content += `\n\n[Code from attachment]:\n${codeContent}`;
            }
          } catch (error) {
            console.error("Error processing attachments:", error);
          }
        }

        return content;
      })
    );

    const context = contextParts.filter(Boolean).join("\n") || "";
    return { context, images };
  } catch (error) {
    console.error("Error fetching message context:", error);
    return { context: repliedMessage.content || "", images: [] };
  }
}

export async function extractCodeFromAttachments(
  message: Message
): Promise<string | null> {
  let extractedCode = "";

  for (const attachment of message.attachments.values()) {
    const { name, url, contentType, size } = attachment;

    // Skip if file is too large (>1MB)
    if (size && size > 1024 * 1024) {
      console.log(`Skipping large file: ${name} (${size} bytes)`);
      continue;
    }

    // Check if it's text-based content
    if (contentType?.startsWith("text/") || !contentType) {
      try {
        console.log(`Fetching code from attachment: ${name}`);
        const response = await fetch(url);

        if (!response.ok) {
          console.error(`Failed to fetch ${name}: ${response.status}`);
          continue;
        }

        const content = await response.text();

        // Limit content length to prevent token overflow
        const maxLength = 8000;
        const truncatedContent =
          content.length > maxLength
            ? content.substring(0, maxLength) + "\n... (content truncated)"
            : content;

        if (extractedCode) {
          extractedCode += `\n\n--- File: ${name} ---\n`;
        } else {
          extractedCode += `--- File: ${name} ---\n`;
        }
        extractedCode += truncatedContent;
      } catch (error) {
        console.error(`Error fetching attachment ${name}:`, error);
      }
    }
  }

  return extractedCode || null;
}

export async function makeImageParts(message: Message): Promise<string[]> {
  const images: string[] = [];

  for (const attachment of message.attachments.values()) {
    if (attachment.contentType?.startsWith("image/")) {
      // Filter out GIFs - Google Gemini doesn't support them
      if (attachment.contentType === "image/gif") {
        continue;
      }

      // Check if file is accessible - if not, don't add it at all
      try {
        const response = await fetch(attachment.url, { method: "HEAD" });
        if (response.ok) {
          images.push(attachment.url);
        }
        // If response is not ok (404, etc.), we simply don't add it - no logging needed
      } catch (error) {
        // If fetch fails, we simply don't add it - no logging needed
      }
    }
  }

  for (const sticker of message.stickers.values()) {
    if (sticker.format !== StickerFormatType.Lottie) {
      if (
        sticker.format === StickerFormatType.PNG ||
        sticker.format === StickerFormatType.APNG
      ) {
        try {
          const response = await fetch(sticker.url, { method: "HEAD" });
          if (response.ok) {
            images.push(sticker.url);
          }
          // If response is not ok, we simply don't add it
        } catch (error) {
          // If fetch fails, we simply don't add it
        }
      }
    }
  }

  return images;
}
