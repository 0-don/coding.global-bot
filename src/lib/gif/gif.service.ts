export class GifService {
  private static readonly TENOR_API_KEY = process.env.TENOR_API_KEY;
  private static readonly BASE_URL = "https://tenor.googleapis.com/v2/search";

  static async searchGifs(query: string, limit: number = 5): Promise<string[]> {
    if (!this.TENOR_API_KEY) {
      console.warn("TENOR_API_KEY not configured - GIF search disabled");
      return [];
    }

    try {
      const params = new URLSearchParams({
        q: query,
        key: this.TENOR_API_KEY,
        limit: limit.toString(),
        contentfilter: "off",
        media_filter: "gif",
        random: "true",
      });

      const response = await fetch(`${this.BASE_URL}?${params}`);

      if (!response.ok) {
        throw new Error(`Tenor API error: ${response.status}`);
      }

      const data = await response.json();

      return (
        data.results
          ?.map((result: any) => result.media_formats?.gif?.url)
          .filter(Boolean) || []
      );
    } catch (error) {
      console.error("Error fetching GIFs:", error);
      return [];
    }
  }

  static async getRandomMeme(
    category: string = "programming",
  ): Promise<string | null> {
    const gifs = await this.searchGifs(`${category} meme`, 10);
    return gifs.length > 0
      ? gifs[Math.floor(Math.random() * gifs.length)]
      : null;
  }
}
