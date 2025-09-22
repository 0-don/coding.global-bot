import { ModelMessage } from "ai";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Collection, Message, StickerFormatType } from "discord.js";
import { searchMemeGifs } from "./tools";

dayjs.extend(relativeTime);

export const channelMessages = new Map<string, ModelMessage[]>();
export const MAX_MESSAGES_PER_CHANNEL = 20;
export const CODING_GLOBAL_PATTERN = /^coding\s?global/i;
export const TOOLS = { searchMemeGifs };

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
        if (msg.attachments.size > 0) {
          try {
            const msgImages = await makeImageParts(msg);
            images.push(...msgImages);
          } catch (error) {
            console.error("Error processing images:", error);
          }
        }
        return msg.content?.trim() || "";
      })
    );

    const context = contextParts.filter(Boolean).join("\n") || "";
    return { context, images };
  } catch (error) {
    console.error("Error fetching message context:", error);
    return { context: repliedMessage.content || "", images: [] };
  }
}

export async function makeImageParts(message: Message): Promise<string[]> {
  const images: string[] = [];

  for (const attachment of message.attachments.values()) {
    if (attachment.contentType?.startsWith("image/")) {
      // Filter out GIFs - Google Gemini doesn't support them
      if (attachment.contentType === "image/gif") {
        console.log(`Skipping GIF attachment: ${attachment.url}`);
        continue;
      }
      images.push(attachment.url);
    }
  }

  for (const sticker of message.stickers.values()) {
    if (sticker.format !== StickerFormatType.Lottie) {
      // Only include non-GIF stickers (PNG/APNG format stickers)
      if (
        sticker.format === StickerFormatType.PNG ||
        sticker.format === StickerFormatType.APNG
      ) {
        images.push(sticker.url);
      } else {
        console.log(`Skipping GIF sticker: ${sticker.url}`);
      }
    }
  }

  return images;
}
