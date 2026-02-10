# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "matplotlib>=3.9",
#     "pillow>=10.0",
# ]
# ///
"""Generate equation PNG assets used by scaling dropdown previews.

This script renders all scaling equations into transparent PNGs.

Usage (uv):
    uv run scripts/make_equations.py
    uv run scripts/make_equations.py --out-dir src/static/equations
    uv run scripts/make_equations.py --names sinh,asinh

Usage (python):
    python scripts/make_equations.py
"""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

import matplotlib.patheffects as path_effects
import matplotlib.pyplot as plt
from PIL import Image

ROOT = Path(__file__).parent.parent
DEFAULT_OUT_DIR = ROOT / "src" / "static" / "equations_generated"


def equation(rhs: str) -> str:
    return rf"$y\,=\,{rhs}$"


EQUATION_LATEX: dict[str, str] = {
    "linear": equation(r"x"),
    "log": equation(r"\log_{\alpha+1}(\alpha x+1)"),
    "sqrt": equation(r"\sqrt{x}"),
    "squared": equation(r"x^2"),
    "gamma": equation(r"x^{\gamma}"),
    "power": equation(r"(\alpha^x-1)/(\alpha-1)"),
    "sinh": equation(r"\sinh(3x)/\sinh(3)"),
    "asinh": equation(r"\operatorname{asinh}(10x)/\operatorname{asinh}(10)"),
}


def parse_names(value: str | None) -> list[str]:
    if not value:
        return list(EQUATION_LATEX.keys())
    names = [name.strip() for name in value.split(",") if name.strip()]
    if unknown := [name for name in names if name not in EQUATION_LATEX]:
        raise ValueError(f"Unknown equation names: {', '.join(unknown)}")
    return names


def configure_matplotlib_fonts() -> None:
    plt.rcdefaults()
    plt.rcParams["mathtext.fontset"] = "cm"
    plt.rcParams["font.family"] = "serif"


def render_raw(latex_expr: str) -> Image.Image:
    """Render a LaTeX expression and return the tight-cropped RGBA image."""
    fig = plt.figure(figsize=(12, 1), dpi=200)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis("off")
    text = ax.text(
        0.02,
        0.5,
        latex_expr,
        fontsize=54,
        va="center",
        ha="left",
        color="#333333",
        transform=ax.transAxes,
    )

    text.set_path_effects(
        [
            path_effects.Stroke(linewidth=0.5, foreground="#333333"),
            path_effects.Normal(),
        ]
    )

    buf = BytesIO()
    plt.savefig(buf, format="png", transparent=True, bbox_inches="tight", pad_inches=0)
    plt.close(fig)

    buf.seek(0)
    img = Image.open(buf).convert("RGBA")
    if bbox := img.getchannel("A").getbbox():
        img = img.crop(bbox)

    return img


def scale_and_pad(
    img: Image.Image, scale_factor: float, target_height: int
) -> Image.Image:
    """Scale image by *scale_factor* and pad to *target_height*.

    Left / right / bottom stay tight against content.
    Extra transparent space is added at the top only.
    """
    scaled_width = max(1, int(round(img.width * scale_factor)))
    scaled_height = max(1, int(round(img.height * scale_factor)))
    img = img.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)

    if img.height < target_height:
        # Pad at top so bottom (text baseline) stays tight
        padded = Image.new("RGBA", (img.width, target_height), (0, 0, 0, 0))
        padded.paste(img, (0, target_height - img.height))
        img = padded

    return img


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate equation PNG assets.")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUT_DIR})",
    )
    parser.add_argument(
        "--names",
        default=None,
        help="Comma-separated subset of equation names",
    )
    args = parser.parse_args()

    names = parse_names(args.names)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_fonts()

    target_height = 54
    scale_factor = 0.322

    print(f"Generating equations into: {args.out_dir}")

    for name in names:
        raw_img = render_raw(EQUATION_LATEX[name])
        img = scale_and_pad(raw_img, scale_factor, target_height)
        output_path = args.out_dir / f"{name}.png"
        img.save(output_path)
        print(f"  - {name}: {output_path} ({img.width}x{img.height})")


if __name__ == "__main__":
    main()
