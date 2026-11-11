#!/usr/bin/env python3
"""
Bake the high-resolution terrain patch around Rifugio Tuckett.

Source: Provincia Autonoma di Trento, "LiDAR PAT 2014 integrato con voli
2018", DTM at 0.5 m in 500 x 500 m tiles (ETRS89 / UTM 32N), CC BY 4.0.
Where the 2014 survey has no tiles (west of the Tuckett) the 2006/2009
survey fills in, at 2 m; the two agree to a few centimetres where both exist.
The tile index comes from the public WFS of the provincial geoserver; the
files come from the same download service the STEM web map uses
(https://siat.provincia.tn.it/stem/), a few tiles at a time.

The patch is resampled on the same linear lat/lon grid as
public/terrain/brenta.json, so the client can lay it over the base terrain:

  public/terrain/lidar.u16   uint16 heights in decimetres, row-major, north first, 0 = no data
  public/terrain/lidar.json  bounds, size and cell size

Downloaded zips are cached in node_modules/.cache/lidar. Standard library only:

  python3 scripts/bake-lidar.py
"""

import http.cookiejar
import io
import json
import math
import struct
import time
import urllib.parse
import urllib.request
import zipfile
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "terrain"
CACHE = ROOT / "node_modules" / ".cache" / "lidar"

# From Rifugio Tuckett (46.19196, 10.88228) to beyond the Bocca di Tuckett and Cima Brenta.
NORTH, SOUTH = 46.200, 46.176
WEST, EAST = 10.870, 10.906
CELL = 3.0  # metres between samples of the baked patch

WFS = "https://siat.provincia.tn.it/geoserver/wfs"
LAYER = "stem:inqlid2014_dtm_asc"
FALLBACK_LAYER = "stem:inqlid2009_dtm_asc"
STEM = "https://siat.provincia.tn.it/stem/"
BATCH = 6


def to_utm32(lat, lon):
    """Geographic ETRS89 to UTM zone 32N (GRS80), accurate to well under a metre here."""
    a, f, k0 = 6378137.0, 1 / 298.257222101, 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    phi, lam = math.radians(lat), math.radians(lon - 9.0)
    sin, cos, tan = math.sin(phi), math.cos(phi), math.tan(phi)
    n = a / math.sqrt(1 - e2 * sin * sin)
    t, c, A = tan * tan, ep2 * cos * cos, cos * lam
    e4, e6 = e2 * e2, e2 * e2 * e2
    m = a * (
        (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
        - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * math.sin(2 * phi)
        + (15 * e4 / 256 + 45 * e6 / 1024) * math.sin(4 * phi)
        - (35 * e6 / 3072) * math.sin(6 * phi)
    )
    easting = 500000 + k0 * n * (
        A + (1 - t + c) * A**3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * A**5 / 120
    )
    northing = k0 * (
        m
        + n
        * tan
        * (
            A * A / 2
            + (5 - t + 9 * c + 4 * c * c) * A**4 / 24
            + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * A**6 / 720
        )
    )
    return easting, northing


def tile_index(layer=LAYER):
    query = urllib.parse.urlencode(
        {
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "typeName": layer,
            "outputFormat": "application/json",
            "srsName": "EPSG:4326",
            "bbox": f"{WEST},{SOUTH},{EAST},{NORTH},EPSG:4326",
        }
    )
    with urllib.request.urlopen(f"{WFS}?{query}", timeout=120) as res:
        features = json.load(res)["features"]
    tiles = [f["properties"] for f in features]
    for t in tiles:
        t.setdefault("n_tavola", Path(t["location"]).name.split("_")[0].split(".")[0])
    return tiles


def download(tiles):
    """Fetch the tile zips through the STEM download service, caching them."""
    CACHE.mkdir(parents=True, exist_ok=True)
    missing = [t for t in tiles if not (CACHE / f"{t['n_tavola']}.zip").exists()]
    if not missing:
        return
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.open(STEM, timeout=60).read()
    for start in range(0, len(missing), BATCH):
        batch = missing[start : start + BATCH]
        print(f"request {start + len(batch)}/{len(missing)}", ", ".join(t["n_tavola"] for t in batch))
        body = json.dumps({"files": [t["location"] for t in batch]}).encode()
        req = urllib.request.Request(
            STEM + "services/merge", data=body, headers={"Content-Type": "application/json"}
        )
        job = json.load(opener.open(req, timeout=120))
        ident = f"id={job['id']}&token={job['token']}"
        for _ in range(60):
            info = json.load(opener.open(f"{STEM}services/file/info?{ident}", timeout=60))
            if info.get("state") == 1:
                break
            if info.get("state") not in (0, None):
                raise SystemExit(f"download failed: {info}")
            time.sleep(5)
        outer = zipfile.ZipFile(io.BytesIO(opener.open(f"{STEM}services/file?{ident}", timeout=600).read()))
        for name in outer.namelist():
            tile = Path(name).name.split("_")[0].split(".")[0]
            (CACHE / f"{tile}.zip").write_bytes(outer.read(name))
        time.sleep(2)  # be gentle with a public service


def read_tile(tile_id):
    inner = zipfile.ZipFile(CACHE / f"{tile_id}.zip")
    text = inner.read(inner.namelist()[0]).decode("ascii")
    lines = text.split("\n", 6)
    header = {}
    for line in lines[:6]:
        key, value = line.split()
        header[key.upper()] = float(value)
    # Some tiles give the corner of the grid, others the centre of the first cell.
    if "XLLCORNER" in header:
        header["XLLCENTER"] = header["XLLCORNER"] + header["CELLSIZE"] / 2
        header["YLLCENTER"] = header["YLLCORNER"] + header["CELLSIZE"] / 2
    values = array("f", map(float, lines[6].split()))
    return header, values


def main():
    tiles = tile_index()
    fallback = tile_index(FALLBACK_LAYER)
    print(len(tiles), "tiles,", len(fallback), "fallback tiles")
    download(tiles + fallback)

    def load(entries):
        out = []
        for t in entries:
            header, values = read_tile(t["n_tavola"])
            x0 = header["XLLCENTER"] - header["CELLSIZE"] / 2
            y0 = header["YLLCENTER"] - header["CELLSIZE"] / 2
            out.append((x0, y0, header, values))
            print("read", t["n_tavola"])
        return out

    grids = load(tiles) + load(fallback)  # the 2014 survey wins where both exist

    def sample(e, n):
        for x0, y0, header, values in grids:
            cols, rows, cell = int(header["NCOLS"]), int(header["NROWS"]), header["CELLSIZE"]
            if x0 <= e < x0 + cols * cell and y0 <= n < y0 + rows * cell:
                h = sample_grid(e, n, x0, y0, header, values)
                if h is not None:
                    return h
        return None

    def sample_grid(e, n, x0, y0, header, values):
        cols, rows, cell = int(header["NCOLS"]), int(header["NROWS"]), header["CELLSIZE"]
        fx = (e - x0) / cell - 0.5
        fy = (n - y0) / cell - 0.5
        i = min(cols - 2, max(0, int(fx)))
        j = min(rows - 2, max(0, int(fy)))
        dx, dy = min(1, max(0, fx - i)), min(1, max(0, fy - j))
        # ASC rows are stored north first.
        r0, r1 = rows - 1 - j, rows - 2 - j
        v = [values[r0 * cols + i], values[r0 * cols + i + 1], values[r1 * cols + i], values[r1 * cols + i + 1]]
        if min(v) <= -9000:
            return None
        return (v[0] * (1 - dx) + v[1] * dx) * (1 - dy) + (v[2] * (1 - dx) + v[3] * dx) * dy

    mid = math.radians((NORTH + SOUTH) / 2)
    size_x = (EAST - WEST) * 111_320 * math.cos(mid)
    size_z = (NORTH - SOUTH) * 110_574
    width, height = round(size_x / CELL) + 1, round(size_z / CELL) + 1
    out = array("H")
    missing = 0
    for j in range(height):
        lat = NORTH - (NORTH - SOUTH) * j / (height - 1)
        for i in range(width):
            lon = WEST + (EAST - WEST) * i / (width - 1)
            h = sample(*to_utm32(lat, lon))
            if h is None:
                missing += 1
                out.append(0)
            else:
                out.append(max(1, min(65535, round(h * 10))))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "lidar.u16").write_bytes(out.tobytes())
    meta = {
        "width": width,
        "height": height,
        "bounds": {"north": NORTH, "south": SOUTH, "west": WEST, "east": EAST},
        "sizeMeters": {"x": round(size_x), "z": round(size_z)},
        "cellMeters": CELL,
        "heightScale": 0.1,
        "missing": missing,
        "source": "Provincia Autonoma di Trento, LiDAR PAT 2014 integrato con voli 2018 (DTM 0.5 m) and LiDAR 2006/2009 (DTM 2 m), CC BY 4.0",
    }
    (OUT / "lidar.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
