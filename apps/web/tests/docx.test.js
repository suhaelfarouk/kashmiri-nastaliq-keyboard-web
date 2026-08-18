import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { docxToHtml, isLegacyDoc, jsonToDocxBuffer, primaryCssFont } from "../src/core/docx-document.js";

describe("docx conversion", () => {
  it("reads the primary face out of a CSS stack", () => {
    assert.equal(
      primaryCssFont('"Faiz Lahori Nastaleeq Local", "Gulmarg Nastaliq", serif'),
      "Faiz Lahori Nastaleeq",
    );
    assert.equal(primaryCssFont("Noto Nastaliq Urdu, serif"), "Noto Nastaliq Urdu");
  });

  it("detects Word 97-2003 OLE files", () => {
    assert.equal(isLegacyDoc(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1])), true);
    assert.equal(isLegacyDoc(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), false);
  });

  it("rejects legacy .doc buffers instead of mangling them", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    await assert.rejects(
      () => docxToHtml(ole.buffer),
      /Word 97/,
    );
  });

  it("round-trips Kashmiri formatting through .docx", async () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "کٲشُری" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "یہ " },
            { type: "text", marks: [{ type: "bold" }], text: "کٲشُر" },
            { type: "text", text: " متن ہے۔" },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "ایک" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await jsonToDocxBuffer(json, {
      fontFamily: "Noto Nastaliq Urdu",
      fontSizePx: 28,
      lineHeight: 2.05,
      title: "test",
    });
    assert.ok(buffer.byteLength > 1000);

    const html = await docxToHtml(buffer);
    assert.match(html, /کٲشُری/);
    assert.match(html, /کٲشُر/);
    assert.match(html, /ایک/);
    assert.match(html, /<(strong|b)>/);
    assert.match(html, /<h1/);
  });
});
