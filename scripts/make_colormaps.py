# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "matplotlib",
#     "numpy",
# ]
# ///
# Usage (uv): uv run make_colormaps.py --out ../src/static/allmaps.png
# Usage (python): python make_colormaps.py --out ../src/static/allmaps.png
import argparse
from typing import Sequence

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np

COLOR_MAPS_ALL = [
    "Accent",
    "afmhot",
    "autumn",
    "binary",
    "Blues",
    "bone",
    "BrBG",
    "brg",
    "BuGn",
    "BuPu",
    "bwr",
    "CMRmap",
    "cool",
    "coolwarm",
    "copper",
    "cubehelix",
    "Dark2",
    "flag",
    "gist_earth",
    "gist_gray",
    "gist_heat",
    "gist_ncar",
    "gist_rainbow",
    "gist_stern",
    "gist_yarg",
    "GnBu",
    "gnuplot",
    "gnuplot2",
    "gray",
    "Greens",
    "Grays",
    "hot",
    "hsv",
    "inferno",
    "jet",
    "magma",
    "nipy_spectral",
    "ocean",
    "Oranges",
    "OrRd",
    "Paired",
    "Pastel1",
    "Pastel2",
    "pink",
    "PiYG",
    "plasma",
    "PRGn",
    "prism",
    "PuBu",
    "PuBuGn",
    "PuOr",
    "PuRd",
    "Purples",
    "rainbow",
    "RdBu",
    "RdGy",
    "RdPu",
    "RdYlBu",
    "RdYlGn",
    "Reds",
    "seismic",
    "Set1",
    "Set2",
    "Set3",
    "Spectral",
    "spring",
    "summer",
    "tab10",
    "tab20",
    "tab20b",
    "tab20c",
    "terrain",
    "viridis",
    "winter",
    "Wistia",
    "YlGn",
    "YlGnBu",
    "YlOrBr",
    "YlOrRd",
    # Add new matplotlib colormaps above.
    # The names below are the last eight entries of COLOR_MAPS_ALL
    # in RenderConfigStore.ts; keep them commented because they are
    # pseudo-monochrome presets (defined in COLOR_MAPS_MONO), not real
    # matplotlib colormap names.
    # "Red",
    # "Orange",
    # "Yellow",
    # "Green",
    # "Cyan",
    # "Blue",
    # "Violet",
    # "Magenta",
]


def build_image(
    cmaps: Sequence[mpl.colors.Colormap], width=1024, stripe_height=5
) -> np.ndarray:
    x = np.linspace(0, 1, width, dtype=np.float32)[None, :]
    grad = np.tile(x, (stripe_height, 1))
    rows = np.vstack([cmap(grad, bytes=True) for cmap in cmaps])
    return rows


def main():
    parser = argparse.ArgumentParser(
        description="Generate an colormaps image."
    )
    parser.add_argument("--out", type=str, default="allmaps.png")
    args = parser.parse_args()

    # Get cmaps from names
    cmaps = [mpl.colormaps.get_cmap(name) for name in COLOR_MAPS_ALL]

    # Build image
    image = build_image(cmaps)
    plt.imsave(args.out, image, dpi=72)


if __name__ == "__main__":
    main()
