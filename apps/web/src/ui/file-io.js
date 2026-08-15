/**
 * Open / download Markdown files without a backend.
 */

export function normalizeMarkdownFileName(name) {
  const trimmed = (name || "").trim() || "document.md";
  return trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`;
}

export function downloadMarkdown(markdown, fileName = "document.md") {
  const name = normalizeMarkdownFileName(fileName);
  const blob = new Blob([markdown ?? ""], { type: "text/markdown;charset=utf-8" });
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

/**
 * Read a user-selected text/markdown file.
 * @returns {Promise<{ markdown: string, fileName: string }>}
 */
export function readMarkdownFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        markdown: String(reader.result ?? ""),
        fileName: normalizeMarkdownFileName(file.name),
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Wire a hidden file input to an open button.
 */
export function bindOpenMarkdown({ button, input, onOpen }) {
  if (!button || !input) return () => {};

  const pick = () => input.click();
  const change = async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const result = await readMarkdownFile(file);
    await onOpen?.(result);
  };

  button.addEventListener("click", pick);
  input.addEventListener("change", change);
  return () => {
    button.removeEventListener("click", pick);
    input.removeEventListener("change", change);
  };
}
