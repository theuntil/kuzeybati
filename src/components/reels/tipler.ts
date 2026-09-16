/** Reels akışındaki tek haber. `reels_akis` fonksiyonunun döndürdüğü yapı. */
export interface Reel {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: unknown;
  published_at: string | null;
  category_slug: string | null;
  category_name: string | null;
  category_adlar: Record<string, string> | null;
  city_name: string | null;
  byline: string | null;
  author_id: string | null;
  author_name: string | null;
  author_username: string | null;
  author_avatar: string | null;
  kaynak: string | null;
  kaynak_logo: string | null;
  kaynak_logo_dark: string | null;
  kaynak_slug: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  video: {
    id: string;
    storage_key: string;
    poster_key: string | null;
    variants: unknown;
    width: number | null;
    height: number | null;
    duration_sec: number | null;
  } | null;
  gorseller: {
    id: string;
    storage_key: string;
    variants: unknown;
    blurhash: string | null;
  }[];
}
