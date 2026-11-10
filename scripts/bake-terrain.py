#!/usr/bin/env python3
"""
Bake the Brenta Dolomites heightmap used by the 3D home page.

Downloads Terrarium elevation tiles (AWS Open Data "Terrain Tiles", derived
from SRTM and other public DEMs), stitches them, crops the area between Monte
Spinale and the Brenta group and writes:

  public/terrain/brenta.u16   little-endian uint16 heights in metres, row-major, north first
  public/terrain/brenta.json  width, height, bounds and the real-world size in metres

Standard library only. Run it again only to change the area or resolution:

  python3 scripts/bake-terrain.py
"""

import json
import math
import struct
import urllib.request
import zlib
from pathlib import Path

ZOOM = 13
NORTH, SOUTH = 46.290, 46.115
WEST, EAST = 10.780, 10.975
OUT_W = 640  # samples west-east; the north-south count follows the real aspect ratio

URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "terrain"


def to_pixel(lat, lon, z=ZOOM):
    n = 2**z * 256
    x = (lon + 180) / 360 * n
    lr = math.radians(lat)
    y = (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n
    return x, y


def decode_png(data):
    """Minimal decoder for the 8-bit RGB/RGBA, non-interlaced PNGs served as Terrarium tiles."""
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, idat, width = 8, b"", 0
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        kind = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", body)
            assert depth == 8 and color in (2, 6) and interlace == 0, (depth, color, interlace)
            bpp = 3 if color == 2 else 4
        elif kind == b"IDAT":
            idat += body
        pos += 12 + length
    raw = zlib.decompress(idat)
    stride = width * bpp
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(height):
        f = raw[i]
        line = bytearray(raw[i + 1 : i + 1 + stride])
        i += 1 + stride
        for k in range(stride):
            a = line[k - bpp] if k >= bpp else 0
            b = prev[k]
            c = prev[k - bpp] if k >= bpp else 0
            if f == 1:
                line[k] = (line[k] + a) & 255
            elif f == 2:
                line[k] = (line[k] + b) & 255
            elif f == 3:
                line[k] = (line[k] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[k] = (line[k] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append([(line[j] * 256 + line[j + 1] + line[j + 2] / 256) - 32768 for j in range(0, stride, bpp)])
        prev = line
    return rows


def main():
    x0, y0 = to_pixel(NORTH, WEST)
    x1, y1 = to_pixel(SOUTH, EAST)
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256)

    tiles = {}
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            url = URL.format(z=ZOOM, x=tx, y=ty)
            print("fetch", url)
            with urllib.request.urlopen(url) as res:
                tiles[(tx, ty)] = decode_png(res.read())

    def sample(px, py):
        tx, ty = int(px // 256), int(py // 256)
        return tiles[(tx, ty)][int(py) % 256][int(px) % 256]

    def bilinear(px, py):
        fx, fy = math.floor(px), math.floor(py)
        dx, dy = px - fx, py - fy
        a, b = sample(fx, fy), sample(fx + 1, fy)
        c, d = sample(fx, fy + 1), sample(fx + 1, fy + 1)
        return (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy

    mid = math.radians((NORTH + SOUTH) / 2)
    size_x = (EAST - WEST) * 111_320 * math.cos(mid)
    size_z = (NORTH - SOUTH) * 110_574
    out_h = round(OUT_W * size_z / size_x)

    heights = []
    for j in range(out_h):
        lat = NORTH - (NORTH - SOUTH) * j / (out_h - 1)
        for i in range(OUT_W):
            lon = WEST + (EAST - WEST) * i / (OUT_W - 1)
            px, py = to_pixel(lat, lon)
            heights.append(max(0, round(bilinear(px, py))))

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "brenta.u16").write_bytes(struct.pack(f"<{len(heights)}H", *heights))
    meta = {
        "width": OUT_W,
        "height": out_h,
        "bounds": {"north": NORTH, "south": SOUTH, "west": WEST, "east": EAST},
        "sizeMeters": {"x": round(size_x), "z": round(size_z)},
        "minHeight": min(heights),
        "maxHeight": max(heights),
        "source": "Terrain Tiles on AWS Open Data (Terrarium), zoom " + str(ZOOM),
    }
    (OUT / "brenta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
