# Scripts

## make_colormaps.py

Generates a stacked colormap PNG (`src/static/allmaps.png`) from CARTA's colormap definitions.

### Using uv (recommended)

[uv](https://docs.astral.sh/uv/) automatically handles dependencies via the inline script metadata.

Install uv:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Run the script:

```bash
uv run scripts/make_colormaps.py
```

### Using Python directly

Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
```

> **Note:** On some systems (e.g., macOS), use `python3` instead of `python` for `python -m venv .venv`.

Then run:

```bash
python scripts/make_colormaps.py
```

### Options

- `--out FILE` — Output to a custom path instead of `src/static/allmaps.png`
