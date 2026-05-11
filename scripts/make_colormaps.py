# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "matplotlib>=3.9",
#     "numpy>=1.25",
# ]
# ///
"""Generate a stacked colormap PNG from CARTA's colormap definitions.

This script reads the ColorMap enum from src/enums/color.ts and
COLOR_MAPS_MONO from src/utilities/color/constants.ts, filters out monochrome
colormaps, and generates a single PNG image with each colormap rendered as a
horizontal stripe. The output is used by the CARTA frontend for both colormap
previews (in the dropdown selector) and as a lookup texture for WebGL rendering
of image tiles, contours, and overlays.

Usage (uv):
    uv run make_colormaps.py              # Output to src/static/allmaps.png
    uv run make_colormaps.py --out FILE   # Output to custom path
Usage (python):
    python make_colormaps.py              # Output to src/static/allmaps.png
    python make_colormaps.py --out FILE   # Output to custom path

For Python users, it is best to install dependencies matching the script header
(python>=3.11, matplotlib>=3.9, numpy>=1.25) before running directly.
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


def extract_color_map_enum(file: str | PathLike) -> dict[str, str]:
    """Extract the ColorMap enum member/value mapping from color.ts."""
    text = Path(file).read_text()
    match = re.search(
        r"export enum ColorMap \{(?P<body>.*?)^\}",
        text,
        re.MULTILINE | re.DOTALL,
    )
    if not match:
        raise ValueError("ColorMap enum not found in src/enums/color.ts")

    body = match.group("body")
    entries = dict(
        re.findall(r'^\s*([A-Za-z0-9_]+)\s*=\s*"([^"]+)"\s*,?\s*$', body, re.MULTILINE)
    )
    if not entries:
        raise ValueError("No ColorMap enum entries found in src/enums/color.ts")

    return entries


def extract_mono_color_maps(
    file: str | PathLike, color_map_enum: dict[str, str]
) -> list[str]:
    """Extract COLOR_MAPS_MONO values from constants.ts."""
    text = Path(file).read_text()
    match = re.search(
        r"export const COLOR_MAPS_MONO\s*=\s*new Map<string, string>\(\[(?P<body>.*?)\]\);",
        text,
        re.MULTILINE | re.DOTALL,
    )
    if not match:
        raise ValueError("COLOR_MAPS_MONO not found in src/utilities/color/constants.ts")

    body = match.group("body")
    mono_names: list[str] = []
    for enum_name, literal_name in re.findall(
        r'\[(?:ColorMap\.([A-Za-z0-9_]+)|"([^"]+)")\s*,\s*"[^"]+"\]',
        body,
    ):
        if enum_name:
            try:
                mono_names.append(color_map_enum[enum_name])
            except KeyError as exc:
                raise ValueError(
                    f"Unknown ColorMap member referenced by COLOR_MAPS_MONO: {enum_name}"
                ) from exc
        else:
            mono_names.append(literal_name)

    if not mono_names:
        raise ValueError("COLOR_MAPS_MONO is empty in src/utilities/color/constants.ts")

    return mono_names


def validate_colormap_order(
    color_maps_all: list[str], color_maps_mono: list[str]
) -> None:
    """Validate COLOR_MAPS_MONO entries exist and are the trailing block of COLOR_MAPS_ALL."""
    if not color_maps_all:
        raise ValueError("ColorMap enum is empty in src/enums/color.ts")
    if not color_maps_mono:
        raise ValueError("COLOR_MAPS_MONO not found in src/utilities/color/constants.ts")

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

    root = Path(__file__).parent.parent
    color_enum_file = root / "src" / "enums" / "color.ts"
    color_constants_file = root / "src" / "utilities" / "color" / "constants.ts"

    # Extract ColorMap enum values and monochrome subset.
    color_map_enum = extract_color_map_enum(color_enum_file)
    color_maps_all = list(color_map_enum.values())
    color_maps_mono = extract_mono_color_maps(color_constants_file, color_map_enum)

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
