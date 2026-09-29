import { describe, expect, it } from "vitest";
import { type Board, computerMove, emptyBoard, getOutcome, play } from "@/games/tic-tac-toe/logic";

const b = (s: string): Board => s.split("").map((c) => (c === "." ? null : (c as "X" | "O")));

describe("tic-tac-toe", () => {
  it("starts empty with no outcome", () => {
    expect(emptyBoard()).toHaveLength(9);
    expect(getOutcome(emptyBoard())).toBeNull();
  });

  it.each([
    ["XXX......", [0, 1, 2]],
    ["...OOO...", [3, 4, 5]],
    ["X..X..X..", [0, 3, 6]],
    ["O...O...O", [0, 4, 8]],
    ["..X.X.X..", [2, 4, 6]],
  ])("detects a win on %s", (board, line) => {
    const outcome = getOutcome(b(board));
    expect(outcome).toMatchObject({ kind: "win", line });
  });

  it("detects a draw", () => {
    expect(getOutcome(b("XOXXOOOXX"))).toEqual({ kind: "draw" });
  });

  it("play places a mark only on an empty cell", () => {
    const board = play(emptyBoard(), 4, "X");
    expect(board[4]).toBe("X");
    expect(play(board, 4, "O")).toBe(board);
  });

  it("play is ignored once the game is over", () => {
    const board = b("XXX.OO...");
    expect(play(board, 3, "O")).toBe(board);
  });

  it("computer takes a winning move", () => {
    expect(computerMove(b("OO.XX...X"), "O", () => 0)).toBe(2);
  });

  it("computer blocks the player's winning move", () => {
    expect(computerMove(b("XX..O...."), "O", () => 0)).toBe(2);
  });

  it("computer takes the centre when free", () => {
    expect(computerMove(b("X........"), "O", () => 0)).toBe(4);
  });

  it("computer never picks an occupied cell", () => {
    for (let i = 0; i < 200; i++) {
      let board = emptyBoard();
      let turn: "X" | "O" = "X";
      while (!getOutcome(board)) {
        const move = computerMove(board, turn, Math.random);
        expect(board[move]).toBeNull();
        board = play(board, move, turn);
        turn = turn === "X" ? "O" : "X";
      }
    }
  });
});
