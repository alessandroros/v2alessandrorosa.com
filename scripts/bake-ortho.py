#!/usr/bin/env python3
"""
Download the orthophoto draped on the 3D terrain of the home page.

Source: Provincia Autonoma di Trento, "Ortofoto digitale 2015" (0.2 m, RGB),
served by the SIAT WMS. Check the licence before publishing the files:
https://www.provincia.tn.it/News/Approfondimenti/Ortofoto-digitale-2015

The area and the linear lat/lon sampling match public/terrain/brenta.json,
so the image maps 1:1 onto the heightmap UVs. The picture is split into a
grid of JPEG tiles (the WMS refuses very large single images) that the
browser stitches into one texture:

  public/terrain/ortho/r{row}c{col}.jpg
  public/terrain/ortho.json

Standard library only:

  python3 scripts/bake-ortho.py
"""

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
META = json.loads((ROOT / "public" / "terrain" / "brenta.json").read_text())
OUT = ROOT / "public" / "terrain" / "ortho"

WMS = "https://siat.provincia.tn.it/geoserver/stem/ecw-rgb-2015/wms"
LAYER = "ecw-rgb-2015"
COLS, ROWS = 2, 2
WIDTH = 3200  # whole image, west-east; height follows the heightmap aspect


def main():
    b = META["bounds"]
    height = round(WIDTH * META["height"] / META["width"])
    tile_w, tile_h = WIDTH // COLS, height // ROWS
    OUT.mkdir(parents=True, exist_ok=True)
    for r in range(ROWS):
        for c in range(COLS):
            north = b["north"] - (b["north"] - b["south"]) * r / ROWS
            south = b["north"] - (b["north"] - b["south"]) * (r + 1) / ROWS
            west = b["west"] + (b["east"] - b["west"]) * c / COLS
            east = b["west"] + (b["east"] - b["west"]) * (c + 1) / COLS
            query = urllib.parse.urlencode(
                {
                    "service": "WMS",
                    "version": "1.3.0",
                    "request": "GetMap",
                    "layers": LAYER,
                    "styles": "",
                    "crs": "EPSG:4326",  # WMS 1.3.0: axis order is lat, lon
                    "bbox": f"{south},{west},{north},{east}",
                    "width": tile_w,
                    "height": tile_h,
                    "format": "image/jpeg",
                }
            )
            path = OUT / f"r{r}c{c}.jpg"
            print("fetch", path.name)
            with urllib.request.urlopen(f"{WMS}?{query}", timeout=180) as res:
                if not res.headers.get("Content-Type", "").startswith("image/"):
                    raise SystemExit(f"WMS error: {res.read()[:500]!r}")
                path.write_bytes(res.read())
            time.sleep(1)  # be gentle with a public service

    (ROOT / "public" / "terrain" / "ortho.json").write_text(
        json.dumps(
            {
                "cols": COLS,
                "rows": ROWS,
                "tileWidth": tile_w,
                "tileHeight": tile_h,
                "bounds": b,
                "source": "Provincia Autonoma di Trento, Ortofoto digitale 2015 (SIAT WMS)",
            },
            indent=2,
        )
        + "\n"
    )


if __name__ == "__main__":
    main()
