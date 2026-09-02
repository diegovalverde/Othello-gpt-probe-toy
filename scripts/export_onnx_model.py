#!/usr/bin/env python3
"""Export Neel Nanda's Othello-GPT as a browser-loadable ONNX graph.

The exported graph has one input:

    tokens: int64[batch, pos]

and eight outputs, all taken at the final sequence position:

    resid_post_l4: float32[batch, 512]
    resid_post_l6: float32[batch, 512]
    resid_post_l7: float32[batch, 512]
    board_state_l4: float32[batch, 64, 3]
    direct_legality_post6: float32[batch, 64]
    capture_ray_post6: float32[batch, 64, 8]
    preference_post7: float32[batch, 64]
    final_logits: float32[batch, 61]

This script deliberately exports model activations, logits, and learned probe
heads only. It does not emit precomputed probe decisions, ranked moves, or
analysis result fixtures.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from torch import nn


TRANSFORMER_LENS_ROOT = Path(
    "/Users/diegovalverdegarro/workspace/projects/TransformerLens"
)
if str(TRANSFORMER_LENS_ROOT) not in sys.path:
    sys.path.insert(0, str(TRANSFORMER_LENS_ROOT))

from transformer_lens import HookedTransformer, HookedTransformerConfig, utils  # noqa: E402


HOOK_OUTPUTS = (
    ("blocks.4.hook_resid_post", "resid_post_l4"),
    ("blocks.6.hook_resid_post", "resid_post_l6"),
    ("blocks.7.hook_resid_post", "resid_post_l7"),
)

CAPTURE_PROBE_PATH = (
    TRANSFORMER_LENS_ROOT
    / "demos/othello_jacobian_lens_outputs/capture_predicate_probe_20260829_090316/capture_probe_state.pt"
)
DIRECT_LEGALITY_PROBE_PATH = (
    TRANSFORMER_LENS_ROOT
    / "demos/othello_jacobian_lens_outputs/direct_legality_probe_20260830_011103/direct_legality_probe_state.pt"
)
PREFERENCE_PROBE_PATH = (
    TRANSFORMER_LENS_ROOT
    / "demos/othello_jacobian_lens_outputs/l7_legal_move_preference_20260830_223054/l7_preference_probe_state.pt"
)
BOARD_STATE_PROBE_PATH = (
    TRANSFORMER_LENS_ROOT / "demos/othello_board_probe_layer4_strict_split.pt"
)


class NormalizedLinearProbe(nn.Module):
    def __init__(self, checkpoint_path: Path, hook_name: str) -> None:
        super().__init__()
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        entry = checkpoint[hook_name]
        state_dict = entry["state_dict"]
        linear = nn.Linear(
            state_dict["linear.weight"].shape[1],
            state_dict["linear.weight"].shape[0],
        )
        linear.weight.data.copy_(state_dict["linear.weight"])
        linear.bias.data.copy_(state_dict["linear.bias"])
        linear.eval()
        self.linear = linear
        self.register_buffer("mean", entry["mean"].float())
        self.register_buffer("std", entry["std"].float())

    def forward(self, activation: torch.Tensor) -> torch.Tensor:
        normalized = (activation - self.mean) / self.std
        return self.linear(normalized)


class RawLinearProbe(nn.Module):
    def __init__(self, checkpoint_path: Path) -> None:
        super().__init__()
        if not checkpoint_path.exists():
            raise FileNotFoundError(
                f"Missing L4 board probe checkpoint: {checkpoint_path}. "
                "Generate it with TransformerLens/scripts/render_othello_probe_board.py first."
            )
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        state_dict = checkpoint["state_dict"]
        linear = nn.Linear(state_dict["weight"].shape[1], state_dict["weight"].shape[0])
        linear.load_state_dict(state_dict)
        linear.eval()
        self.linear = linear

    def forward(self, activation: torch.Tensor) -> torch.Tensor:
        return self.linear(activation)


class OthelloGptOnnxWrapper(nn.Module):
    """Thin export wrapper that returns the activations used by the toy UI."""

    def __init__(self, model: HookedTransformer) -> None:
        super().__init__()
        self.model = model
        self.board_state_l4 = RawLinearProbe(BOARD_STATE_PROBE_PATH)
        self.direct_legality_post6 = NormalizedLinearProbe(
            DIRECT_LEGALITY_PROBE_PATH, "blocks.6.hook_resid_post"
        )
        self.capture_ray_post6 = NormalizedLinearProbe(
            CAPTURE_PROBE_PATH, "blocks.6.hook_resid_post"
        )
        self.preference_post7 = NormalizedLinearProbe(
            PREFERENCE_PROBE_PATH, "blocks.7.hook_resid_post"
        )
        self._cache: dict[str, torch.Tensor] = {}
        self._handles = [
            self.model.hook_dict[hook_name].register_forward_hook(
                self._capture_hook(hook_name)
            )
            for hook_name, _output_name in HOOK_OUTPUTS
        ]

    def _capture_hook(self, hook_name: str):
        def hook(_module: nn.Module, _inputs: tuple[torch.Tensor, ...], output: torch.Tensor):
            self._cache[hook_name] = output

        return hook

    def forward(self, tokens: torch.Tensor) -> tuple[torch.Tensor, ...]:
        self._cache = {}
        logits = self.model(tokens, return_type="logits")
        if logits is None:
            raise RuntimeError("Othello-GPT returned no logits")

        missing = [hook_name for hook_name, _ in HOOK_OUTPUTS if hook_name not in self._cache]
        if missing:
            joined = ", ".join(missing)
            raise RuntimeError(f"Missing hook activations during export: {joined}")

        resid_post_l4 = self._cache["blocks.4.hook_resid_post"][:, -1, :].contiguous()
        resid_post_l6 = self._cache["blocks.6.hook_resid_post"][:, -1, :].contiguous()
        resid_post_l7 = self._cache["blocks.7.hook_resid_post"][:, -1, :].contiguous()

        board_state_l4 = self.board_state_l4(resid_post_l4).reshape(-1, 64, 3).contiguous()
        direct_legality_post6 = self.direct_legality_post6(resid_post_l6).contiguous()
        capture_ray_post6 = self.capture_ray_post6(resid_post_l6).reshape(-1, 64, 8).contiguous()
        preference_post7 = self.preference_post7(resid_post_l7).contiguous()

        return (
            resid_post_l4,
            resid_post_l6,
            resid_post_l7,
            board_state_l4,
            direct_legality_post6,
            capture_ray_post6,
            preference_post7,
            logits[:, -1, :].contiguous(),
        )

    def close(self) -> None:
        for handle in self._handles:
            handle.remove()
        self._handles = []


def load_othello_gpt(device: torch.device) -> HookedTransformer:
    cfg = HookedTransformerConfig(
        n_layers=8,
        d_model=512,
        d_head=64,
        n_heads=8,
        d_mlp=2048,
        d_vocab=61,
        n_ctx=59,
        act_fn="gelu",
        normalization_type="LNPre",
        device=str(device),
    )
    model = HookedTransformer(cfg)
    state_dict = utils.download_file_from_hf(
        "NeelNanda/Othello-GPT-Transformer-Lens", "synthetic_model.pth"
    )
    model.load_state_dict(state_dict)
    model.eval()
    return model


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/model/othello-gpt-activations.onnx"),
        help="Destination ONNX file.",
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=17,
        help="ONNX opset version.",
    )
    parser.add_argument(
        "--atol",
        type=float,
        default=1e-4,
        help="Absolute tolerance for ONNX Runtime parity check.",
    )
    parser.add_argument(
        "--rtol",
        type=float,
        default=1e-4,
        help="Relative tolerance for ONNX Runtime parity check.",
    )
    return parser.parse_args()


def export_onnx(wrapper: OthelloGptOnnxWrapper, output_path: Path, opset: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    example_tokens = torch.tensor([[20, 19, 18, 10, 2, 1, 27]], dtype=torch.long)

    torch.onnx.export(
        wrapper,
        (example_tokens,),
        output_path,
        input_names=["tokens"],
        output_names=[
            "resid_post_l4",
            "resid_post_l6",
            "resid_post_l7",
            "board_state_l4",
            "direct_legality_post6",
            "capture_ray_post6",
            "preference_post7",
            "final_logits",
        ],
        dynamic_axes={
            "tokens": {0: "batch", 1: "pos"},
            "resid_post_l4": {0: "batch"},
            "resid_post_l6": {0: "batch"},
            "resid_post_l7": {0: "batch"},
            "board_state_l4": {0: "batch"},
            "direct_legality_post6": {0: "batch"},
            "capture_ray_post6": {0: "batch"},
            "preference_post7": {0: "batch"},
            "final_logits": {0: "batch"},
        },
        opset_version=opset,
        do_constant_folding=True,
        dynamo=False,
    )


def verify_onnx(
    wrapper: OthelloGptOnnxWrapper,
    output_path: Path,
    atol: float,
    rtol: float,
) -> dict[str, float]:
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)

    tokens = torch.tensor([[20, 19, 18, 10, 2, 1, 27, 9, 0]], dtype=torch.long)
    with torch.no_grad():
        torch_outputs = [output.detach().cpu().numpy() for output in wrapper(tokens)]

    session = ort.InferenceSession(
        str(output_path),
        providers=["CPUExecutionProvider"],
    )
    ort_outputs = session.run(None, {"tokens": tokens.numpy().astype(np.int64)})

    max_abs_diffs: dict[str, float] = {}
    output_names = [
        "resid_post_l4",
        "resid_post_l6",
        "resid_post_l7",
        "board_state_l4",
        "direct_legality_post6",
        "capture_ray_post6",
        "preference_post7",
        "final_logits"
    ]
    for output_name, torch_output, ort_output in zip(
        output_names, torch_outputs, ort_outputs, strict=True
    ):
        max_abs_diff = float(np.max(np.abs(torch_output - ort_output)))
        max_abs_diffs[output_name] = max_abs_diff
        np.testing.assert_allclose(
            ort_output,
            torch_output,
            rtol=rtol,
            atol=atol,
            err_msg=output_name,
        )
    return max_abs_diffs


def main() -> None:
    args = parse_args()
    torch.set_grad_enabled(False)
    device = torch.device("cpu")
    model = load_othello_gpt(device)
    wrapper = OthelloGptOnnxWrapper(model)
    try:
        export_onnx(wrapper, args.output, args.opset)
        diffs = verify_onnx(wrapper, args.output, args.atol, args.rtol)
    finally:
        wrapper.close()

    size_mb = args.output.stat().st_size / (1024 * 1024)
    print(f"wrote {args.output} ({size_mb:.1f} MiB)")
    print("max absolute ONNX Runtime diffs:")
    for output_name, diff in diffs.items():
        print(f"  {output_name}: {diff:.6g}")


if __name__ == "__main__":
    main()
