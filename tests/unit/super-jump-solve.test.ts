import { describe, expect, it } from "vitest";
import { type Input, type JumpState, allLevels, createGame, step } from "@/games/super-jump/logic";

const DT = 1 / 60;
const MACRO = 10;

type Node = { s: JumpState; frames: number; parent: Node | null; label: string };

/** A best-first search over held-input macros; villains are removed so only the terrain is checked. */
function solve(index: number, maxNodes = 30_000): { ok: boolean; nodes: number; bestX: number; trail: string[] } {
  const level = { ...allLevels()[index], enemies: [] };
  const start = createGame(level);
  const flagX = level.flag.x * 16;
  const key = (s: JumpState) =>
    [
      Math.round(s.player.x / 5),
      Math.round(s.player.y / 5),
      Math.round(s.player.vy / 90),
      Math.round(s.player.vx / 50),
      s.player.onGround ? 1 : 0,
      s.riding ?? -1,
      s.platforms.map((p) => Math.round(p.offset / 10) + (p.dir > 0 ? "a" : "b")).join(""),
    ].join("|");
  const actions: { dir: number; jump: number; label: string }[] = [];
  for (const dir of [1, 0, -1]) for (const jump of [0, 4, MACRO]) actions.push({ dir, jump, label: `${dir}/${jump}` });
  const open: Node[] = [{ s: start, frames: 0, parent: null, label: "" }];
  const score = (n: Node) => flagX - n.s.player.x + n.frames * 0.15;
  const seen = new Set<string>([key(start)]);
  let nodes = 0;
  let bestX = 0;
  while (open.length && nodes < maxNodes) {
    // pop the best (linear scan on a small heap-less array is too slow: use a binary heap)
    let bi = 0;
    for (let i = open.length - 1; i > Math.max(0, open.length - 400); i--) if (score(open[i]) < score(open[bi])) bi = i;
    const [cur] = open.splice(bi, 1);
    nodes++;
    for (const a of actions) {
      let s = cur.s;
      let dead = false;
      for (let f = 0; f < MACRO; f++) {
        const input: Input = { left: a.dir < 0, right: a.dir > 0, jump: f < a.jump };
        s = step(s, input, DT);
        if (s.status === "won") {
          const trail: string[] = [a.label];
          for (let n: Node | null = cur; n; n = n.parent) trail.push(n.label);
          return { ok: true, nodes, bestX, trail: trail.reverse() };
        }
        if (s.lives < start.lives || s.status === "lost") {
          dead = true;
          break;
        }
      }
      if (dead) continue;
      const k = key(s);
      if (seen.has(k)) continue;
      seen.add(k);
      bestX = Math.max(bestX, s.player.x);
      open.push({ s, frames: cur.frames + MACRO, parent: cur, label: a.label });
    }
  }
  return { ok: false, nodes, bestX, trail: [] };
}

describe("levels can be finished on foot", () => {
  for (let i = 0; i < 4; i++) {
    it(`level ${i + 1}`, () => {
      const r = solve(i);
      expect(r.ok, `stuck at x=${Math.round(r.bestX)} (tile ${Math.round(r.bestX / 16)}) after ${r.nodes} nodes`).toBe(true);
    }, 120_000);
  }
});
