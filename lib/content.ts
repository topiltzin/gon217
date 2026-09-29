import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import type { Locale } from "./i18n";
import { CARD_COLORS, ICON_NAMES } from "./icon-names";

/**
 * Host content lives in content/ and is validated at build time. An invalid
 * edit throws a ContentError naming the file and field, which fails the build
 * and leaves the previous deployment live.
 *
 * Text fields are English; optional Spanish versions sit alongside them (an
 * `es` object in JSON, `titleEs`/`bodyEs` in announcement frontmatter). Missing
 * Spanish falls back to English.
 */

const CONTENT_DIR = path.join(process.cwd(), "content");

export class ContentError extends Error {
  constructor(file: string, detail: string) {
    super(`Invalid content in ${file}: ${detail}`);
    this.name = "ContentError";
  }
}

function validate<T extends z.ZodType>(schema: T, data: unknown, file: string): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ContentError(file, detail);
  }
  return result.data;
}

const text = (max: number) => z.string().trim().min(1).max(max);

const siteSchema = z
  .object({
    name: text(40),
    tagline: text(100),
    host: z.object({
      name: z.string().trim().min(1),
      welcome: text(400),
      avatar: z.string().optional(),
      avatarAlt: z.string().trim().min(1).optional(),
    }),
    es: z.object({ name: text(40), tagline: text(100), welcome: text(400) }).partial().optional(),
  })
  .refine((site) => !site.host.avatar || site.host.avatarAlt, {
    message: "avatarAlt is required when avatar is set",
    path: ["host", "avatarAlt"],
  });

export type Site = z.output<typeof siteSchema>;

export const GAME_STATUSES = ["available", "new", "coming-soon"] as const;

const gameSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase-kebab"),
  title: text(30),
  description: text(80),
  instructions: text(160),
  icon: z.enum(ICON_NAMES),
  color: z.enum(CARD_COLORS),
  status: z.enum(GAME_STATUSES),
  featured: z.boolean().default(false),
  es: z.object({ title: text(30), description: text(80), instructions: text(160) }).partial().optional(),
});

export type Game = z.output<typeof gameSchema>;

const HTML_TAG = /<\/?[a-z][^>]*>/i;
const EXTERNAL_LINK = /(https?:\/\/|www\.)/i;

const plainBody = text(400)
  .refine((body) => !HTML_TAG.test(body), "raw HTML is not allowed")
  .refine((body) => !EXTERNAL_LINK.test(body), "external links are not allowed");

const announcementSchema = z.object({
  title: text(60),
  date: z.iso.date(),
  gameSlug: z.string().optional(),
  body: plainBody,
  titleEs: text(60).optional(),
  bodyEs: plainBody.optional(),
});

export type Announcement = z.output<typeof announcementSchema> & { id: string };

// Only YouTube videos, playlists, shorts, and channels; nothing else may be linked.
const YOUTUBE_URL =
  /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=[\w-]{11}(&[\w=&-]*)?|playlist\?list=[\w-]+|shorts\/[\w-]{11}|@[\w.-]+)|youtu\.be\/[\w-]{11})$/;

const videoSchema = z.object({
  title: text(60),
  titleEs: text(60).optional(),
  url: z.string().regex(YOUTUBE_URL, "must be a YouTube video, playlist, short, or channel link"),
});

export type Video = z.output<typeof videoSchema>;

const STATUS_ORDER: Record<Game["status"], number> = { new: 1, available: 2, "coming-soon": 3 };

export function parseSite(data: unknown, file: string): Site {
  return validate(siteSchema, data, file);
}

export function parseGames(data: unknown, file: string): Game[] {
  const games = validate(z.array(gameSchema), data, file);
  const seen = new Set<string>();
  for (const game of games) {
    if (seen.has(game.slug)) throw new ContentError(file, `duplicate slug "${game.slug}"`);
    seen.add(game.slug);
  }
  const rank = (g: Game) => (g.featured && g.status !== "coming-soon" ? 0 : STATUS_ORDER[g.status]);
  // Array.prototype.sort is stable, so file order is kept within a group.
  return games.sort((a, b) => rank(a) - rank(b));
}

export function parseAnnouncement(source: string, file: string, gameSlugs: string[]): Announcement {
  const { data, content } = matter(source);
  // YAML turns unquoted dates into Date objects; normalise to YYYY-MM-DD.
  const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : data.date;
  const announcement = validate(announcementSchema, { ...data, date, body: content }, file);
  if (announcement.gameSlug && !gameSlugs.includes(announcement.gameSlug)) {
    throw new ContentError(file, `gameSlug: no game with slug "${announcement.gameSlug}"`);
  }
  return { ...announcement, id: path.basename(file, ".md") };
}

export function parseVideos(data: unknown, file: string): Video[] {
  return validate(z.array(videoSchema), data, file);
}

function readJson(relative: string): unknown {
  return JSON.parse(readFileSync(path.join(CONTENT_DIR, relative), "utf8"));
}

export function getSite(locale: Locale = "en"): Site {
  const site = parseSite(readJson("site.json"), "content/site.json");
  if (locale === "en" || !site.es) return site;
  return {
    ...site,
    name: site.es.name ?? site.name,
    tagline: site.es.tagline ?? site.tagline,
    host: { ...site.host, welcome: site.es.welcome ?? site.host.welcome },
  };
}

function localizeGame(game: Game, locale: Locale): Game {
  if (locale === "en" || !game.es) return game;
  return {
    ...game,
    title: game.es.title ?? game.title,
    description: game.es.description ?? game.description,
    instructions: game.es.instructions ?? game.instructions,
  };
}

export function getGames(locale: Locale = "en"): Game[] {
  return parseGames(readJson("games.json"), "content/games.json").map((g) => localizeGame(g, locale));
}

export function getPlayableGames(locale: Locale = "en"): Game[] {
  return getGames(locale).filter((g) => g.status !== "coming-soon");
}

export function getGame(slug: string, locale: Locale = "en"): Game | undefined {
  return getPlayableGames(locale).find((g) => g.slug === slug);
}

export function getAnnouncements(locale: Locale = "en"): Announcement[] {
  const dir = path.join(CONTENT_DIR, "announcements");
  const slugs = getGames().map((g) => g.slug);
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  return files
    .map((f) =>
      parseAnnouncement(readFileSync(path.join(dir, f), "utf8"), `content/announcements/${f}`, slugs),
    )
    .map((a) =>
      locale === "es" ? { ...a, title: a.titleEs ?? a.title, body: a.bodyEs ?? a.body } : a,
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function getVideos(locale: Locale = "en"): Video[] {
  if (!existsSync(path.join(CONTENT_DIR, "videos.json"))) return [];
  return parseVideos(readJson("videos.json"), "content/videos.json").map((v) =>
    locale === "es" ? { ...v, title: v.titleEs ?? v.title } : v,
  );
}
