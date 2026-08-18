/**
 * Open / download Word documents without a backend.
 *
 * Interchange format is OOXML .docx. Legacy binary .doc is rejected with a
 * message asking the user to re-save in Word. Plain .txt is accepted as a
 * convenience for pasting a transcript dump.
 *
 * The `docx` and mammoth libraries are imported only when a file is opened or
 * downloaded so they stay out of the initial editor bundle.
 */

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function normalizeDocxFileName(name) {
  const trimmed = (name || "").trim() || "document.docx";
  return /\.docx$/i.test(trimmed) ? trimmed : `${trimmed.replace(/\.(md|txt|doc)$/i, "")}.docx`;
}

export function escapeTextAsHtml(text) {
  const escaped = String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  if (!escaped.trim()) return "<p></p>";
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function downloadDocx(blob, fileName = "document.docx") {
  const name = normalizeDocxFileName(fileName);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return name;
}

export async function downloadDocxFromJson(json, fileName, options) {
  const { jsonToDocxBlob } = await import("../core/docx-document.js");
  const blob = await jsonToDocxBlob(json, {
    ...options,
    title: normalizeDocxFileName(fileName).replace(/\.docx$/i, ""),
  });
  return downloadDocx(blob, fileName);
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * @returns {Promise<{ html: string, fileName: string }>}
 */
export async function readDocumentFile(file) {
  if (!file) throw new Error("No file selected");
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".doc") && !lower.endsWith(".docx")) {
    throw new Error(
      "This is a Word 97–2003 .doc file. Save it as .docx in Word and open that instead.",
    );
  }

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    const text = await readAsText(file);
    return {
      html: escapeTextAsHtml(text),
      fileName: normalizeDocxFileName(file.name),
    };
  }

  const buffer = await readAsArrayBuffer(file);
  const { docxToHtml } = await import("../core/docx-document.js");
  const html = await docxToHtml(buffer);
  return {
    html,
    fileName: normalizeDocxFileName(file.name),
  };
}

export function bindOpenDocument({ button, input, onOpen, onError }) {
  if (!button || !input) return () => {};

  const pick = () => input.click();
  const change = async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const result = await readDocumentFile(file);
      await onOpen?.(result);
    } catch (error) {
      onError?.(error);
    }
  };

  button.addEventListener("click", pick);
  input.addEventListener("change", change);
  return () => {
    button.removeEventListener("click", pick);
    input.removeEventListener("change", change);
  };
}
