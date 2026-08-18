/**
 * Convert Tiptap JSON to an OOXML .docx file, and .docx files back to HTML.
 *
 * The editor stays a browser WYSIWYG (ProseMirror). Word is the interchange
 * format, not the editing engine. Round-trip covers headings 1–3, paragraphs,
 * lists, blockquotes, code blocks, bold/italic/strike, links, and horizontal
 * rules. Images, tables, comments, and the legacy binary .doc format are not
 * supported — Word 97–2003 files must be saved as .docx first.
 *
 * Paragraphs are marked bidirectional and right-aligned so Kashmiri Nastaliq
 * survives opening in Word. The chosen font is named in the file; the font
 * file itself is not embedded (Faiz Lahori must not be redistributed).
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import mammoth from "mammoth";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const HEADING = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
};

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

export function isLegacyDoc(bytes) {
  if (!bytes || bytes.length < 4) return false;
  return OLE_MAGIC.every((value, i) => bytes[i] === value);
}

export function primaryCssFont(cssFamily) {
  if (!cssFamily) return "Noto Nastaliq Urdu";
  const quoted = cssFamily.match(/"([^"]+)"/);
  if (quoted) return quoted[1].replace(/ Local$/, "");
  return cssFamily.split(",")[0].trim() || "Noto Nastaliq Urdu";
}

function pxToHalfPoints(px) {
  const value = Number(px);
  if (!Number.isFinite(value) || value <= 0) return 42;
  return Math.round(value * 1.5);
}

function isRtlRun(ltr) {
  return !ltr;
}

function textRun(text, marks = [], { font, size, ltr = false } = {}) {
  const href = marks.find((mark) => mark.type === "link")?.attrs?.href;
  const run = new TextRun({
    text,
    font: ltr ? "Courier New" : font,
    size,
    bold: marks.some((mark) => mark.type === "bold"),
    italics: marks.some((mark) => mark.type === "italic"),
    strike: marks.some((mark) => mark.type === "strike"),
    rightToLeft: isRtlRun(ltr),
    language: ltr ? { value: "en-US" } : { value: "en-US", bidirectional: "ks" },
  });
  if (!href) return run;
  return new ExternalHyperlink({ children: [run], link: href });
}

function inlineChildren(nodes = [], options) {
  const children = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      children.push(new TextRun({ break: 1 }));
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const ltr = options.ltr || (node.marks ?? []).some((mark) => mark.type === "code");
    children.push(textRun(node.text, node.marks ?? [], { ...options, ltr }));
  }
  return children;
}

function paragraphFromBlock(node, options, extra = {}) {
  const ltr = extra.ltr || node.type === "codeBlock";
  const children = inlineChildren(node.content, { ...options, ltr });
  return new Paragraph({
    bidirectional: !ltr,
    alignment: ltr ? AlignmentType.LEFT : AlignmentType.RIGHT,
    heading: extra.heading,
    numbering: extra.numbering,
    indent: extra.indent,
    spacing: {
      line: Math.round(240 * (options.lineHeight || 2.05)),
      lineRule: "auto",
    },
    children: children.length
      ? children
      : [new TextRun({ text: "", rightToLeft: !ltr, font: options.font, size: options.size })],
  });
}

function blocksToParagraphs(nodes = [], options, listContext) {
  const paragraphs = [];
  for (const node of nodes) {
    paragraphs.push(...blockToParagraphs(node, options, listContext));
  }
  return paragraphs;
}

function blockToParagraphs(node, options, listContext) {
  if (!node) return [];

  switch (node.type) {
    case "doc":
      return blocksToParagraphs(node.content, options);

    case "paragraph":
      return [
        paragraphFromBlock(node, options, {
          numbering: listContext
            ? { reference: listContext.reference, level: listContext.level }
            : undefined,
          indent: listContext?.quote ? { left: 720 } : undefined,
        }),
      ];

    case "heading": {
      const level = Math.min(Math.max(node.attrs?.level ?? 1, 1), 3);
      return [
        paragraphFromBlock(node, options, {
          heading: HEADING[level],
        }),
      ];
    }

    case "bulletList":
      return listItemsToParagraphs(node, options, {
        reference: "makhzan-bullets",
        level: listContext?.level != null ? listContext.level + 1 : 0,
      });

    case "orderedList":
      return listItemsToParagraphs(node, options, {
        reference: "makhzan-numbers",
        level: listContext?.level != null ? listContext.level + 1 : 0,
      });

    case "listItem":
      return blocksToParagraphs(node.content, options, listContext);

    case "blockquote":
      return blocksToParagraphs(node.content, options, {
        ...listContext,
        quote: true,
      });

    case "codeBlock":
      return [paragraphFromBlock(node, options, { ltr: true })];

    case "horizontalRule":
      return [
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          border: {
            bottom: {
              color: "999999",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 12,
            },
          },
        }),
      ];

    default:
      return node.content ? blocksToParagraphs(node.content, options, listContext) : [];
  }
}

function listItemsToParagraphs(listNode, options, listContext) {
  const paragraphs = [];
  for (const item of listNode.content ?? []) {
    paragraphs.push(...blockToParagraphs(item, options, listContext));
  }
  return paragraphs;
}

function numberingConfig() {
  const bulletLevels = Array.from({ length: 6 }, (_, level) => ({
    level,
    format: LevelFormat.BULLET,
    text: "•",
    alignment: AlignmentType.RIGHT,
  }));
  const numberLevels = Array.from({ length: 6 }, (_, level) => ({
    level,
    format: LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
    alignment: AlignmentType.RIGHT,
  }));
  return [
    { reference: "makhzan-bullets", levels: bulletLevels },
    { reference: "makhzan-numbers", levels: numberLevels },
  ];
}

export function jsonToDocxDocument(
  json,
  { fontFamily, fontSizePx, lineHeight, title } = {},
) {
  const font = fontFamily || "Noto Nastaliq Urdu";
  const size = pxToHalfPoints(fontSizePx);
  const paragraphs = blockToParagraphs(json ?? { type: "doc", content: [] }, {
    font,
    size,
    lineHeight,
  });

  return new Document({
    title: title || "Makhzan document",
    creator: "Makhzan",
    styles: {
      default: {
        document: {
          run: {
            font,
            size,
            rightToLeft: true,
            language: { value: "en-US", bidirectional: "ks" },
          },
          paragraph: {
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
          },
        },
      },
    },
    numbering: { config: numberingConfig() },
    sections: [
      {
        children: paragraphs.length
          ? paragraphs
          : [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT })],
      },
    ],
  });
}

export async function documentToArrayBuffer(doc) {
  const packed = await Packer.toBuffer(doc);
  if (packed instanceof ArrayBuffer) return packed;
  if (ArrayBuffer.isView(packed)) {
    return packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength);
  }
  return packed;
}

export async function jsonToDocxBuffer(json, options) {
  return documentToArrayBuffer(jsonToDocxDocument(json, options));
}

export async function jsonToDocxBlob(json, options) {
  const buffer = await jsonToDocxBuffer(json, options);
  return new Blob([buffer], { type: DOCX_MIME });
}

/**
 * Convert a .docx ArrayBuffer to HTML that Tiptap can load.
 * Rejects Word 97–2003 .doc (OLE) files with a clear error.
 */
export async function docxToHtml(source) {
  const bytes = new Uint8Array(
    source instanceof ArrayBuffer
      ? source
      : source.buffer
        ? source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
        : source,
  );
  if (isLegacyDoc(bytes)) {
    throw new Error(
      "This is a Word 97–2003 .doc file. Save it as .docx in Word and open that instead.",
    );
  }
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  // Node mammoth reads `buffer`; the browser build reads `arrayBuffer`.
  const input =
    typeof Buffer !== "undefined"
      ? { buffer: Buffer.from(bytes), arrayBuffer }
      : { arrayBuffer };
  const result = await mammoth.convertToHtml(input, {
    convertImage: mammoth.images.dataUri,
  });
  return result.value || "<p></p>";
}
