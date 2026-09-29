import { describe, expect, it } from "vitest";
import {
  ContentError,
  getAnnouncements,
  getGames,
  getSite,
  parseAnnouncement,
  parseGames,
  parseSite,
} from "@/lib/content";

const site = {
  name: "Gonzalo's Game Space",
  tagline: "Fun games for friends",
  host: { name: "Gonzalo", welcome: "Hi friends!" },
};

const game = {
  slug: "memory-match",
  title: "Memory Match",
  description: "Find the pairs",
  instructions: "Tap two cards to flip them.",
  icon: "puzzle",
  color: "primary",
  status: "available",
};

describe("parseSite", () => {
  it("accepts valid data", () => {
    expect(parseSite(site, "site.json").host.name).toBe("Gonzalo");
  });

  it.each([
    ["name too long", { ...site, name: "x".repeat(41) }, "name"],
    ["empty name", { ...site, name: "" }, "name"],
    ["tagline too long", { ...site, tagline: "x".repeat(101) }, "tagline"],
    ["welcome too long", { ...site, host: { ...site.host, welcome: "x".repeat(401) } }, "host.welcome"],
    ["missing host name", { ...site, host: { welcome: "hi" } }, "host.name"],
    ["avatar without alt", { ...site, host: { ...site.host, avatar: "/a.png" } }, "host.avatarAlt"],
  ])("rejects %s with file and field in the message", (_label, data, field) => {
    expect(() => parseSite(data, "content/site.json")).toThrowError(ContentError);
    expect(() => parseSite(data, "content/site.json")).toThrowError(
      new RegExp(`content/site\\.json.*${field.replace(".", "\\.")}`),
    );
  });
});

describe("parseGames", () => {
  it("defaults featured to false", () => {
    expect(parseGames([game], "games.json")[0].featured).toBe(false);
  });

  it.each([
    ["title too long", { ...game, title: "x".repeat(31) }, "title"],
    ["description too long", { ...game, description: "x".repeat(81) }, "description"],
    ["instructions too long", { ...game, instructions: "x".repeat(161) }, "instructions"],
    ["bad slug", { ...game, slug: "Memory Match" }, "slug"],
    ["unknown status", { ...game, status: "hidden" }, "status"],
    ["unknown colour", { ...game, color: "beige" }, "color"],
    ["unknown icon", { ...game, icon: "not-an-icon" }, "icon"],
  ])("rejects %s", (_label, data, field) => {
    expect(() => parseGames([data], "content/games.json")).toThrowError(
      new RegExp(`content/games\\.json.*${field}`),
    );
  });

  it("rejects duplicate slugs", () => {
    expect(() => parseGames([game, game], "games.json")).toThrowError(/duplicate slug/i);
  });

  it("sorts featured, then new, then available, then coming soon", () => {
    const games = parseGames(
      [
        { ...game, slug: "soon", status: "coming-soon" },
        { ...game, slug: "plain" },
        { ...game, slug: "fresh", status: "new" },
        { ...game, slug: "star", featured: true },
      ],
      "games.json",
    );
    expect(games.map((g) => g.slug)).toEqual(["star", "fresh", "plain", "soon"]);
  });
});

describe("parseAnnouncement", () => {
  const md = (front: string, body = "A new game is here!") => `---\n${front}\n---\n${body}\n`;

  it("parses frontmatter and body", () => {
    const a = parseAnnouncement(md('title: "Hello"\ndate: 2026-10-01\ngameSlug: memory-match'), "a.md", [
      "memory-match",
    ]);
    expect(a).toMatchObject({ title: "Hello", date: "2026-10-01", gameSlug: "memory-match" });
    expect(a.body).toBe("A new game is here!");
  });

  it.each([
    ["title too long", md(`title: "${"x".repeat(61)}"\ndate: 2026-10-01`), "title"],
    ["missing date", md('title: "Hi"'), "date"],
    ["unknown game", md('title: "Hi"\ndate: 2026-10-01\ngameSlug: nope'), "gameSlug"],
    ["body too long", md('title: "Hi"\ndate: 2026-10-01', "x".repeat(401)), "body"],
    ["raw HTML", md('title: "Hi"\ndate: 2026-10-01', "Hi <script>x</script>"), "body"],
    ["external link", md('title: "Hi"\ndate: 2026-10-01', "Go to https://example.com"), "body"],
  ])("rejects %s", (_label, source, field) => {
    expect(() => parseAnnouncement(source, "content/announcements/a.md", ["memory-match"])).toThrowError(
      new RegExp(`content/announcements/a\\.md.*${field}`),
    );
  });
});

describe("repository content", () => {
  it("is valid", () => {
    expect(getSite().host.name).toBe("Gonzalo");
    expect(getGames().length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(getAnnouncements())).toBe(true);
  });

  it("lists announcements newest first", () => {
    const dates = getAnnouncements().map((a) => a.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
