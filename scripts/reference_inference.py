#!/usr/bin/env python3
"""Run real ONNX probe inference for a move string.

This is a small debugging/reference command for the browser app. It loads the
generated ONNX graph and computes rankings from model/probe outputs, not from
precomputed result files.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort


BOARD_FILES = "ABCDEFGH"
CENTER_SQUARES = {27, 28, 35, 36}
DIRECTIONS = (
    (-1, -1),
    (-1, 0),
    (-1, 1),
    (0, -1),
    (0, 1),
    (1, -1),
    (1, 0),
    (1, 1),
)
DIRECT_POST6_THRESHOLD = 0.9969209432601929
RAY_MAX_POST6_THRESHOLD = 0.8941226601600647

TOKEN_TO_SQUARE: dict[int, int | None] = {0: None}
SQUARE_TO_TOKEN: dict[int, int] = {}
for square in range(64):
    if square not in CENTER_SQUARES:
        token_id = len(SQUARE_TO_TOKEN) + 1
        SQUARE_TO_TOKEN[square] = token_id
        TOKEN_TO_SQUARE[token_id] = square


def square_label(square: int) -> str:
    row, col = divmod(square, 8)
    return f"{BOARD_FILES[col]}{row + 1}"


def label_to_square(label: str) -> int:
    cleaned = label.strip().upper()
    if len(cleaned) != 2 or cleaned[0] not in BOARD_FILES or cleaned[1] not in "12345678":
        raise ValueError(f'Expected a square like C4, got "{label}".')
    return (int(cleaned[1]) - 1) * 8 + BOARD_FILES.index(cleaned[0])


def parse_move_string(move_string: str) -> list[int]:
    token_ids: list[int] = []
    for raw_move in move_string.split():
        move = raw_move.upper()
        if move in {"PASS", "0"}:
            token_ids.append(0)
            continue
        square = label_to_square(move)
        if square in CENTER_SQUARES:
            raise ValueError(f"{move} is a starting-center square, not a move token.")
        token_ids.append(SQUARE_TO_TOKEN[square])
    return token_ids


@dataclass
class OthelloGame:
    board: list[int]
    to_play: int

    @classmethod
    def initial(cls) -> OthelloGame:
        board = [0] * 64
        board[27] = -1
        board[28] = 1
        board[35] = 1
        board[36] = -1
        return cls(board=board, to_play=1)

    def flips_for(self, square: int | None, player: int | None = None) -> list[int]:
        if square is None or self.board[square] != 0:
            return []
        color = self.to_play if player is None else player
        row0, col0 = divmod(square, 8)
        flips: list[int] = []
        for d_row, d_col in DIRECTIONS:
            row = row0 + d_row
            col = col0 + d_col
            line: list[int] = []
            while 0 <= row < 8 and 0 <= col < 8:
                index = row * 8 + col
                value = self.board[index]
                if value == -color:
                    line.append(index)
                elif value == color:
                    if line:
                        flips.extend(line)
                    break
                else:
                    break
                row += d_row
                col += d_col
        return flips

    def legal_squares(self, player: int | None = None) -> list[int]:
        color = self.to_play if player is None else player
        return [square for square in range(64) if self.flips_for(square, color)]

    def apply_token(self, token_id: int, move_index: int) -> None:
        if token_id == 0:
            if self.legal_squares(self.to_play):
                raise ValueError(f"Pass is illegal at move {move_index}.")
            other_player = -self.to_play
            if not self.legal_squares(other_player):
                raise ValueError(f"Pass is invalid at move {move_index}; neither player can move.")
            self.to_play = other_player
            return

        square = TOKEN_TO_SQUARE[token_id]
        flips = self.flips_for(square, self.to_play)
        if not flips:
            raise ValueError(f"{square_label(square)} is illegal at move {move_index}.")
        self.board[square] = self.to_play
        for flip in flips:
            self.board[flip] = self.to_play
        self.to_play = -self.to_play


def sigmoid(values: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-values))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("moves", help='Move string, for example: "F5 D6 C3 D3 C4 F4 E3"')
    parser.add_argument(
        "--model",
        type=Path,
        default=Path("public/model/othello-gpt-activations.onnx"),
        help="Path to the exported ONNX graph.",
    )
    parser.add_argument(
        "--legality-source",
        choices=("direct_post6", "ray_max", "simulator"),
        default="direct_post6",
    )
    parser.add_argument("--top-k", type=int, default=8)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    token_ids = parse_move_string(args.moves)
    game = OthelloGame.initial()
    for index, token_id in enumerate(token_ids, start=1):
        game.apply_token(token_id, index)

    session = ort.InferenceSession(str(args.model), providers=["CPUExecutionProvider"])
    outputs = session.run(None, {"tokens": np.array([token_ids], dtype=np.int64)})
    direct_post6 = sigmoid(outputs[3][0])
    capture_ray_post6 = sigmoid(outputs[4][0])
    preference_post7 = outputs[5][0]
    final_logits = outputs[6][0]

    rows = []
    for square in range(64):
        token_id = SQUARE_TO_TOKEN.get(square)
        if token_id is None:
            continue
        simulator_legal = square in game.legal_squares()
        direct_legal = direct_post6[square] >= DIRECT_POST6_THRESHOLD
        ray_max = float(np.max(capture_ray_post6[square]))
        ray_legal = ray_max >= RAY_MAX_POST6_THRESHOLD
        if args.legality_source == "simulator":
            candidate = simulator_legal
        elif args.legality_source == "direct_post6":
            candidate = direct_legal
        else:
            candidate = ray_legal
        if candidate:
            rows.append(
                (
                    square_label(square),
                    float(preference_post7[square]),
                    float(direct_post6[square]),
                    ray_max,
                    float(final_logits[token_id]),
                    simulator_legal,
                )
            )

    rows.sort(key=lambda row: row[1], reverse=True)
    final_choice = max(
        ((square_label(square), float(final_logits[SQUARE_TO_TOKEN[square]])) for square in game.legal_squares()),
        key=lambda row: row[1],
        default=(None, float("-inf")),
    )[0]

    print(f"tokens: {token_ids}")
    print(f"to_play: {'black' if game.to_play == 1 else 'white'}")
    print(f"probe_choice: {rows[0][0] if rows else None}")
    print(f"final_logit_choice: {final_choice}")
    print("rank square preference_post7 direct_post6 ray_max final_logit simulator_legal")
    for rank, row in enumerate(rows[: args.top_k], start=1):
        square, preference, direct, ray, final_logit, simulator_legal = row
        print(
            f"{rank:>4} {square:<6} {preference:>16.6f} {direct:>12.6f} "
            f"{ray:>7.6f} {final_logit:>11.6f} {str(simulator_legal):>15}"
        )


if __name__ == "__main__":
    main()
