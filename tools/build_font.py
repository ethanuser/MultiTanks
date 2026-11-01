#!/usr/bin/env python3
"""Build fonts/TinyTanks.woff from the glyph table in js/pixelFont.js.

The menus use the same hand-drawn letters as the game canvas, so the table in
pixelFont.js is the only copy of the design. Run this after changing a glyph:

    python3 tools/build_font.py

Needs fonttools (pip install fonttools).
"""

import re
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parent.parent
PIXEL = 100          # Font units per pixel: 10px of type is one pixel to the letter
UNITS_PER_EM = 1000
CAP_ROWS = 7
SPACE_WIDTH = 3


def read_glyphs():
    source = (ROOT / 'js' / 'pixelFont.js').read_text()
    glyphs = {}
    for key, rows in re.findall(r"^\s*'(\\u[0-9A-Fa-f]{4}|\\.|.)':\s*'([.#/]+)',?\s*$", source, re.M):
        if key.startswith('\\u'):
            key = chr(int(key[2:], 16))
        elif key.startswith('\\'):
            key = key[1]
        glyphs[key] = rows.split('/')
    return glyphs


def draw(rows):
    """Trace each row's runs of pixels as rectangles"""
    pen = TTGlyphPen(None)
    for y, row in enumerate(rows):
        top = (CAP_ROWS - y) * PIXEL
        bottom = top - PIXEL
        x = 0
        while x < len(row):
            if row[x] != '#':
                x += 1
                continue
            start = x
            while x < len(row) and row[x] == '#':
                x += 1
            pen.moveTo((start * PIXEL, bottom))
            pen.lineTo((start * PIXEL, top))
            pen.lineTo((x * PIXEL, top))
            pen.lineTo((x * PIXEL, bottom))
            pen.closePath()
    return pen.glyph()


def main():
    glyphs = read_glyphs()
    names = {char: f'u{ord(char):04X}' for char in glyphs}
    order = ['.notdef', 'space'] + list(names.values())

    outlines = {'.notdef': TTGlyphPen(None).glyph(), 'space': TTGlyphPen(None).glyph()}
    metrics = {'.notdef': (PIXEL * 6, 0), 'space': ((SPACE_WIDTH + 1) * PIXEL, 0)}
    for char, rows in glyphs.items():
        outlines[names[char]] = draw(rows)
        width = max(len(row) for row in rows)
        metrics[names[char]] = ((width + 1) * PIXEL, 0)

    builder = FontBuilder(UNITS_PER_EM, isTTF=True)
    builder.setupGlyphOrder(order)
    builder.setupCharacterMap({32: 'space', **{ord(char): name for char, name in names.items()}})
    builder.setupGlyf(outlines)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({'familyName': 'Tiny Tanks', 'styleName': 'Regular'})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200,
                     sCapHeight=700, sxHeight=500)
    builder.setupPost()

    font = builder.font
    font.flavor = 'woff'
    target = ROOT / 'fonts' / 'TinyTanks.woff'
    font.save(target)
    print(f'{target.relative_to(ROOT)}: {len(glyphs)} glyphs, {target.stat().st_size} bytes')


if __name__ == '__main__':
    main()
