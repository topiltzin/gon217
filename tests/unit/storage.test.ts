import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readBest, recordScore } from "@/lib/storage";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const g = globalThis as { window?: unknown };

describe("best score storage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    g.window = { localStorage: storage };
  });

  afterEach(() => {
    delete g.window;
  });

  it("returns null when nothing is stored", () => {
    expect(readBest("memory-match")).toBeNull();
  });

  it("stores under gks:best:<slug> and reports a new best", () => {
    expect(recordScore("catch-it", 12, "higher")).toBe(true);
    expect(JSON.parse(storage.getItem("gks:best:catch-it")!).best).toBe(12);
    expect(readBest("catch-it")?.best).toBe(12);
  });

  it("keeps the better score for higher-is-better games", () => {
    recordScore("catch-it", 12, "higher");
    expect(recordScore("catch-it", 8, "higher")).toBe(false);
    expect(readBest("catch-it")?.best).toBe(12);
  });

  it("keeps the better score for lower-is-better games", () => {
    recordScore("memory-match", 20, "lower");
    expect(recordScore("memory-match", 14, "lower")).toBe(true);
    expect(readBest("memory-match")?.best).toBe(14);
  });

  it("treats corrupt values as no best yet", () => {
    storage.setItem("gks:best:catch-it", "{not json");
    expect(readBest("catch-it")).toBeNull();
    storage.setItem("gks:best:catch-it", JSON.stringify({ best: "lots" }));
    expect(readBest("catch-it")).toBeNull();
  });

  it("survives blocked storage", () => {
    g.window = {
      get localStorage(): never {
        throw new Error("SecurityError");
      },
    };
    expect(readBest("catch-it")).toBeNull();
    expect(recordScore("catch-it", 5, "higher")).toBe(false);
  });

  it("does nothing on the server", () => {
    delete g.window;
    expect(readBest("catch-it")).toBeNull();
  });
});
