export type Player = "X" | "O";
export type Board = (Player | null)[];
export type Rng = () => number;

export type Outcome = { kind: "win"; player: Player; line: number[] } | { kind: "draw" } | null;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function emptyBoard(): Board {
  return Array(9).fill(null);
}

export function getOutcome(board: Board): Outcome {
  for (const line of LINES) {
    const [a, b, c] = line;
    const p = board[a];
    if (p && p === board[b] && p === board[c]) return { kind: "win", player: p, line };
  }
  return board.every(Boolean) ? { kind: "draw" } : null;
}

export function play(board: Board, cell: number, player: Player): Board {
  if (board[cell] !== null || getOutcome(board)) return board;
  const next = [...board];
  next[cell] = player;
  return next;
}

function winningCell(board: Board, player: Player): number | undefined {
  for (const line of LINES) {
    const marks = line.map((i) => board[i]);
    if (marks.filter((m) => m === player).length === 2 && marks.includes(null)) {
      return line[marks.indexOf(null)];
    }
  }
}

/** A friendly opponent: wins if it can, blocks if it must, otherwise centre, then a random free cell. */
export function computerMove(board: Board, me: Player, rng: Rng): number {
  const them: Player = me === "X" ? "O" : "X";
  const win = winningCell(board, me) ?? winningCell(board, them);
  if (win !== undefined) return win;
  if (board[4] === null) return 4;
  const free = board.flatMap((v, i) => (v === null ? [i] : []));
  return free[Math.min(Math.floor(rng() * free.length), free.length - 1)];
}
