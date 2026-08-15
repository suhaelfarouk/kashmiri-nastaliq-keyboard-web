#!/usr/bin/env python3
"""Check that every character the model can emit exists in the bundled font.

The Flutter app renders transcripts in the Noto Nastaliq Urdu face bundled at
`apps/native/assets/fonts/`. Any codepoint missing from that face falls back to a
system font mid-word, which splits the shaping run so neighbouring letters stop
joining. In Nastaliq that is very visible: a dual-joining letter such as U+06AA
swash kaf breaks a whole word apart.

The aggregate IndicConformer tokenizer is shared by 22 languages, so its
vocabulary contains Perso-Arabic letters from Sindhi and Shahmukhi Punjabi that
are not Kashmiri orthography. Those are folded to the form the on-screen keyboard
produces by `kashmiriCharacterFolds` in
`apps/native/lib/core/text/kashmiri_orthography.dart`; this script applies the
same folds before reporting, so the two must stay in sync.

Exits non-zero when an unfolded codepoint is missing from the font.

Usage (from the repo root):

    python3 tools/model/scripts/check_font_coverage.py \
        --vocab tools/model/dist/makhzan-v1.0.0/vocab.json

Reads only the font's `cmap`, so it needs no third-party dependencies.
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_FONT = (
    REPO_ROOT
    / 'apps/native/assets/fonts/NotoNastaliqUrdu-VariableFont_wght.ttf'
)
DEFAULT_FOLDS_SOURCE = (
    REPO_ROOT / 'apps/native/lib/core/text/kashmiri_orthography.dart'
)

# Perso-Arabic plus the marks Kashmiri uses; other scripts in the aggregate
# vocabulary are never rendered by the app.
ARABIC_RANGES = ((0x0600, 0x06FF), (0x0750, 0x077F), (0xFB50, 0xFDFF),
                 (0xFE70, 0xFEFF))


def in_arabic(cp: int) -> bool:
    return any(lo <= cp <= hi for lo, hi in ARABIC_RANGES)


def read_tables(data: bytes) -> dict[str, tuple[int, int]]:
    count = struct.unpack('>H', data[4:6])[0]
    tables = {}
    for i in range(count):
        off = 12 + 16 * i
        tag = data[off:off + 4].decode('latin1')
        start, length = struct.unpack('>II', data[off + 8:off + 16])
        tables[tag] = (start, length)
    return tables


def cmap_coverage(path: Path) -> set[int]:
    """Every codepoint mapped by the font's format 4 and 12 cmap subtables."""
    data = path.read_bytes()
    cmap_start = read_tables(data)['cmap'][0]
    subtable_count = struct.unpack('>H', data[cmap_start + 2:cmap_start + 4])[0]
    covered: set[int] = set()

    for i in range(subtable_count):
        entry = cmap_start + 4 + 8 * i
        offset = struct.unpack('>HHI', data[entry:entry + 8])[2]
        base = cmap_start + offset
        fmt = struct.unpack('>H', data[base:base + 2])[0]

        if fmt == 4:
            seg_bytes = struct.unpack('>H', data[base + 6:base + 8])[0]
            segments = seg_bytes // 2
            ends = struct.unpack(
                f'>{segments}H', data[base + 14:base + 14 + seg_bytes])
            starts_at = base + 16 + seg_bytes
            starts = struct.unpack(
                f'>{segments}H', data[starts_at:starts_at + seg_bytes])
            for start, end in zip(starts, ends):
                if start != 0xFFFF:
                    covered.update(range(start, end + 1))
        elif fmt == 12:
            groups = struct.unpack('>I', data[base + 12:base + 16])[0]
            for g in range(groups):
                off = base + 16 + 12 * g
                start, end, _gid = struct.unpack('>III', data[off:off + 12])
                covered.update(range(start, min(end, start + 0x10000) + 1))

    return covered


def parse_folds(path: Path) -> dict[str, str]:
    """Read `kashmiriCharacterFolds` out of the Dart source."""
    text = path.read_text(encoding='utf-8')
    block = re.search(
        r'kashmiriCharacterFolds\s*=\s*<String,\s*String>\{(.*?)\};',
        text, re.S)
    if not block:
        raise SystemExit(f'could not find kashmiriCharacterFolds in {path}')
    pairs = re.findall(
        r"'\\u([0-9A-Fa-f]{4})'\s*:\s*'\\u([0-9A-Fa-f]{4})'", block.group(1))
    return {chr(int(src, 16)): chr(int(dst, 16)) for src, dst in pairs}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vocab', type=Path, required=True,
                        help='vocab.json from the exported model package')
    parser.add_argument('--font', type=Path, default=DEFAULT_FONT)
    parser.add_argument('--folds-source', type=Path,
                        default=DEFAULT_FOLDS_SOURCE)
    args = parser.parse_args()

    vocab = json.loads(args.vocab.read_text(encoding='utf-8'))
    folds = parse_folds(args.folds_source)
    covered = cmap_coverage(args.font)

    emitted: set[int] = set()
    for piece in vocab:
        for ch in str(piece):
            emitted.add(ord(folds.get(ch, ch)))

    arabic = sorted(cp for cp in emitted if in_arabic(cp))
    missing = [cp for cp in arabic if cp not in covered]

    print(f'font:  {args.font.relative_to(REPO_ROOT)}')
    print(f'vocab: {args.vocab} ({len(vocab)} tokens)')
    print(f'folds applied: {len(folds)} '
          f'({", ".join(f"U+{ord(k):04X}->U+{ord(v):04X}" for k, v in folds.items())})')
    print(f'Perso-Arabic codepoints reachable after folding: {len(arabic)}')

    if missing:
        print(f'\nMISSING from the bundled face: {len(missing)}')
        for cp in missing:
            print(f'  U+{cp:04X}  {chr(cp)}')
        print('\nThese will fall back to a system font and break Nastaliq '
              'joining. Add a fold in kashmiri_orthography.dart or bundle a '
              'face that covers them.')
        return 1

    print('\nOK: every reachable Perso-Arabic codepoint is covered.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
