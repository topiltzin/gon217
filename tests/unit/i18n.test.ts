import { describe, expect, it } from "vitest";
import { getAnnouncements, getGames, getSite, parseVideos } from "@/lib/content";
import { dictionaries, negotiateLocale, otherLocale } from "@/lib/i18n";

describe("negotiateLocale", () => {
  it.each([
    [null, "en"],
    ["", "en"],
    ["es-MX,es;q=0.9,en;q=0.8", "es"],
    ["es", "es"],
    ["en-US,en;q=0.9,es;q=0.8", "en"],
    ["fr-FR,fr;q=0.9,es;q=0.5", "es"],
    ["fr-FR,de;q=0.9", "en"],
    ["en;q=0.2,es;q=0.9", "es"],
  ])("%s → %s", (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });

  it("flips between the two languages", () => {
    expect(otherLocale("en")).toBe("es");
    expect(otherLocale("es")).toBe("en");
  });
});

describe("dictionaries", () => {
  // Every key in English has a Spanish value (TypeScript enforces the shape; this checks nothing is blank).
  function leaves(obj: unknown, prefix = ""): [string, unknown][] {
    return Object.entries(obj as object).flatMap(([k, v]) =>
      v && typeof v === "object" ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v] as [string, unknown]],
    );
  }

  it("Spanish has every string, and none are empty", () => {
    const en = leaves(dictionaries.en).map(([k]) => k);
    const es = leaves(dictionaries.es);
    expect(es.map(([k]) => k)).toEqual(en);
    for (const [key, value] of es) {
      if (typeof value === "string") expect(value, key).not.toBe("");
    }
  });
});

describe("Spanish content", () => {
  it("translates the site, every game, and every announcement", () => {
    expect(getSite("es").tagline).not.toBe(getSite("en").tagline);
    const en = getGames("en");
    const es = getGames("es");
    expect(es.map((g) => g.slug)).toEqual(en.map((g) => g.slug));
    es.forEach((g, i) => expect(g.instructions, g.slug).not.toBe(en[i].instructions));
    const enNews = getAnnouncements("en");
    getAnnouncements("es").forEach((a, i) => expect(a.title, a.id).not.toBe(enNews[i].title));
  });
});

describe("videos", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/@SomeKidsChannel",
    "https://www.youtube.com/playlist?list=PL1234567890abc",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  ])("accepts %s", (url) => {
    expect(parseVideos([{ title: "Fun video", url }], "videos.json")).toHaveLength(1);
  });

  it.each([
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "https://www.youtube.com/watch?v=short",
  ])("rejects %s", (url) => {
    expect(() => parseVideos([{ title: "Fun video", url }], "content/videos.json")).toThrow(
      /content\/videos\.json.*url/,
    );
  });

  it("rejects titles over 60 characters", () => {
    expect(() =>
      parseVideos([{ title: "x".repeat(61), url: "https://youtu.be/dQw4w9WgXcQ" }], "videos.json"),
    ).toThrow(/title/);
  });
});
