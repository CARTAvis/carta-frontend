# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "matplotlib",
#     "numpy",
# ]
# ///
"""Generate a stacked colormap PNG from CARTA's colormap definitions.

This script reads COLOR_MAPS_ALL and COLOR_MAPS_MONO from color.ts,
filters out monochrome colormaps, and generates a single PNG image with each
colormap rendered as a horizontal stripe. The output is used by the CARTA
frontend for both colormap previews (in the dropdown selector) and as a lookup
texture for WebGL rendering of image tiles, contours, and overlays.
"""

import argparse
import re
from collections.abc import Sequence
from os import PathLike
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np

MPL_CMAP_MAPPING = {
    cmap.lower(): mpl.colormaps.get_cmap(cmap) for cmap in mpl.colormaps
}


def extract_color_maps(file: str | PathLike) -> tuple[list[str], list[str]]:
    """Extract COLOR_MAPS_ALL and COLOR_MAPS_MONO from color.ts."""
    results = {
        "COLOR_MAPS_ALL": [],
        "COLOR_MAPS_MONO": [],
    }
    current = None
    with open(file, "r") as f:
        for line in f:
            for name in results:
                if f"{name} = " in line:
                    current = name
                    break
            else:
                if current:
                    if ";" in line:
                        current = None
                    elif match := re.search(r'"(.*?)"', line):
                        results[current].append(match.group(1))
    return results["COLOR_MAPS_ALL"], results["COLOR_MAPS_MONO"]


def validate_colormap_order(
    color_maps_all: list[str], color_maps_mono: list[str]
) -> None:
    """Validate COLOR_MAPS_MONO entries exist and are the trailing block of COLOR_MAPS_ALL."""
    if not color_maps_all:
        raise ValueError("COLOR_MAPS_ALL not found in color.ts")
    if not color_maps_mono:
        raise ValueError("COLOR_MAPS_MONO not found in color.ts")

    missing = [name for name in color_maps_mono if name not in color_maps_all]
    if missing:
        raise ValueError(
            f"COLOR_MAPS_MONO entries missing from COLOR_MAPS_ALL: {missing}"
        )

    indices = [color_maps_all.index(name) for name in color_maps_mono]
    expected_start = len(color_maps_all) - len(color_maps_mono)
    expected_indices = list(range(expected_start, len(color_maps_all)))
    if indices != expected_indices:
        raise ValueError(
            "COLOR_MAPS_MONO entries must appear at the end of COLOR_MAPS_ALL in the same order"
        )


def get_colormaps(names: list[str]) -> Sequence[mpl.colors.Colormap]:
    """Get matplotlib Colormap objects from a list of colormap names."""
    colormaps = []
    not_found = []
    for name in names:
        if name.lower() in MPL_CMAP_MAPPING:
            colormaps.append(MPL_CMAP_MAPPING[name.lower()])
        else:
            not_found.append(name)
    if not_found:
        raise ValueError(f"Colormaps not found in matplotlib: {not_found}")
    return colormaps


def build_image(
    colormaps: Sequence[mpl.colors.Colormap],
    width: int = 1024,
    stripe_height: int = 5,
) -> np.ndarray:
    """Build a stacked colormap image from a sequence of colormaps."""
    x = np.linspace(0, 1, width, dtype=np.float32)[None, :]
    grad = np.tile(x, (stripe_height, 1))
    rows = np.vstack([cmap(grad, bytes=True) for cmap in colormaps])
    return rows


def main():
    """Generate and save a colormap image from CARTA's colormap definitions."""
    parser = argparse.ArgumentParser(description="Generate a colormap image.")
    parser.add_argument("--out", type=str)
    args = parser.parse_args()

    # Set output path
    if args.out is None:
        output = (
            Path(__file__).parent.parent / "src" / "static" / "allmaps.png"
        )
    else:
        output = Path(args.out)

    # Create parent directory if it does not exist
    output.parent.mkdir(parents=True, exist_ok=True)

    # Extract COLOR_MAPS_ALL and COLOR_MAPS_MONO
    file = (
        Path(__file__).parent.parent
        / "src"
        / "utilities"
        / "color"
        / "color.ts"
    )
    color_maps_all, color_maps_mono = extract_color_maps(file)

    # Ensure COLOR_MAPS_MONO is the last entries of COLOR_MAPS_ALL
    validate_colormap_order(color_maps_all, color_maps_mono)

    # Filter out monochrome colormaps
    colormap_names = [
        name for name in color_maps_all if name not in color_maps_mono
    ]

    # Get colormaps
    colormaps = get_colormaps(colormap_names)

    # Build image
    image = build_image(colormaps)

    # Save image
    plt.imsave(output, image, dpi=72)
    print(f"Saved {len(colormaps)} colormaps to {output}")


if __name__ == "__main__":
    main()
