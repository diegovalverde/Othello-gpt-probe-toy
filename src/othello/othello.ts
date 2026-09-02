import type { DiscState, Player } from "../types/probe";

export const BOARD_FILES = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const CENTER_SQUARES = new Set([27, 28, 35, 36]);

const DIRECTIONS: Array<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export const TOKEN_TO_SQUARE = new Map<number, number | null>([[0, null]]);
export const SQUARE_TO_TOKEN = new Map<number, number>();

for (let square = 0; square < 64; square += 1) {
  if (!CENTER_SQUARES.has(square)) {
    const tokenId = SQUARE_TO_TOKEN.size + 1;
    SQUARE_TO_TOKEN.set(square, tokenId);
    TOKEN_TO_SQUARE.set(tokenId, square);
  }
}

export function squareToRowCol(square: number): [number, number] {
  return [Math.floor(square / 8), square % 8];
}

export function rowColToSquare(row: number, col: number): number {
  return row * 8 + col;
}

export function squareLabel(square: number): string {
  const [row, col] = squareToRowCol(square);
  return `${BOARD_FILES[col]}${row + 1}`;
}

export function labelToSquare(label: string): number {
  const cleaned = label.trim().toUpperCase();
  if (!/^[A-H][1-8]$/.test(cleaned)) {
    throw new Error(`Expected a square like C4, got "${label}".`);
  }
  const col = BOARD_FILES.indexOf(cleaned[0] as (typeof BOARD_FILES)[number]);
  const row = Number(cleaned[1]) - 1;
  return rowColToSquare(row, col);
}

export function tokenToLabel(tokenId: number): string {
  if (tokenId === 0) {
    return "pass";
  }
  const square = TOKEN_TO_SQUARE.get(tokenId);
  if (square == null) {
    throw new Error(`Unknown Othello-GPT token ${tokenId}.`);
  }
  return squareLabel(square);
}

export function parseMoveString(input: string): number[] {
  const rawMoves = input.trim().split(/\s+/).filter(Boolean);
  return rawMoves.map((rawMove) => {
    const move = rawMove.toUpperCase();
    if (move === "PASS" || move === "0") {
      return 0;
    }
    const square = labelToSquare(move);
    if (CENTER_SQUARES.has(square)) {
      throw new Error(`${move} is a starting-center square, not a move token.`);
    }
    const tokenId = SQUARE_TO_TOKEN.get(square);
    if (tokenId == null) {
      throw new Error(`No token exists for ${move}.`);
    }
    return tokenId;
  });
}

function playerToValue(player: Player): number {
  return player === "black" ? 1 : -1;
}

function valueToPlayer(value: number): Player {
  return value === 1 ? "black" : "white";
}

export class OthelloGame {
  board: number[];
  toPlay: Player;

  constructor() {
    this.board = Array.from({ length: 64 }, () => 0);
    this.board[27] = -1;
    this.board[28] = 1;
    this.board[35] = 1;
    this.board[36] = -1;
    this.toPlay = "black";
  }

  captureLinesFor(square: number | null, player = this.toPlay): number[][] {
    if (square == null || this.board[square] !== 0) {
      return [];
    }

    const color = playerToValue(player);
    const [row0, col0] = squareToRowCol(square);
    const lines: number[][] = [];

    for (const [dRow, dCol] of DIRECTIONS) {
      let row = row0 + dRow;
      let col = col0 + dCol;
      const line: number[] = [];

      while (row >= 0 && row < 8 && col >= 0 && col < 8) {
        const idx = rowColToSquare(row, col);
        const value = this.board[idx];
        if (value === -color) {
          line.push(idx);
        } else if (value === color) {
          if (line.length > 0) {
            lines.push(line);
          }
          break;
        } else {
          break;
        }
        row += dRow;
        col += dCol;
      }
    }

    return lines;
  }

  flipsFor(square: number | null, player = this.toPlay): number[] {
    return this.captureLinesFor(square, player).flat();
  }

  legalSquares(player = this.toPlay): number[] {
    const legal: number[] = [];
    for (let square = 0; square < 64; square += 1) {
      if (this.flipsFor(square, player).length > 0) {
        legal.push(square);
      }
    }
    return legal;
  }

  applyToken(tokenId: number, moveIndex: number): void {
    if (tokenId === 0) {
      if (this.legalSquares(this.toPlay).length > 0) {
        throw new Error(`Pass is illegal at move ${moveIndex}; current player has legal moves.`);
      }
      const otherPlayer = this.toPlay === "black" ? "white" : "black";
      if (this.legalSquares(otherPlayer).length === 0) {
        throw new Error(`Pass is invalid at move ${moveIndex}; neither player can move.`);
      }
      this.toPlay = otherPlayer;
      return;
    }

    const square = TOKEN_TO_SQUARE.get(tokenId);
    if (square == null) {
      throw new Error(`Unknown Othello-GPT token ${tokenId}.`);
    }

    const flips = this.flipsFor(square, this.toPlay);
    if (flips.length === 0) {
      throw new Error(`${squareLabel(square)} is illegal at move ${moveIndex}.`);
    }

    const color = playerToValue(this.toPlay);
    this.board[square] = color;
    for (const flip of flips) {
      this.board[flip] = color;
    }
    this.toPlay = valueToPlayer(-color);
  }

  stateAt(square: number): DiscState {
    if (this.board[square] === 1) {
      return "black";
    }
    if (this.board[square] === -1) {
      return "white";
    }
    return "empty";
  }
}

export function replayTokens(tokenIds: number[]): OthelloGame {
  const game = new OthelloGame();
  tokenIds.forEach((tokenId, index) => game.applyToken(tokenId, index + 1));
  return game;
}
