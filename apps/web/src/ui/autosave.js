/**
 * Versioned localStorage autosave for HTML + font metadata.
 *
 * Version 1 stored Markdown. Version 2 stores HTML (the WYSIWYG document).
 * v1 drafts are migrated as escaped paragraphs so typed Kashmiri is not lost,
 * though Markdown markers become literal text.
 */

export const AUTOSAVE_KEY = "makhzan-v1";
export const AUTOSAVE_VERSION = 2;

function escapeTextAsHtml(text) {
  const escaped = String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  if (!escaped.trim()) return "";
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function createAutosavePayload({
  html = "",
  fontPresetId,
  fontSize,
  fileName = "document.docx",
  updatedAt = Date.now(),
} = {}) {
  return {
    version: AUTOSAVE_VERSION,
    html,
    fontPresetId,
    fontSize,
    fileName,
    updatedAt,
  };
}

export function serializeAutosave(payload) {
  return JSON.stringify(createAutosavePayload(payload));
}

export function parseAutosave(raw) {
  if (!raw) return null;
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object") return null;
    if (data.version === 1) {
      return createAutosavePayload({
        html: escapeTextAsHtml(typeof data.markdown === "string" ? data.markdown : ""),
        fontPresetId: data.fontPresetId,
        fontSize: typeof data.fontSize === "number" ? data.fontSize : undefined,
        fileName: typeof data.fileName === "string"
          ? data.fileName.replace(/\.md$/i, ".docx")
          : "document.docx",
        updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
      });
    }
    if (data.version !== AUTOSAVE_VERSION) return null;
    return createAutosavePayload({
      html: typeof data.html === "string" ? data.html : "",
      fontPresetId: data.fontPresetId,
      fontSize: typeof data.fontSize === "number" ? data.fontSize : undefined,
      fileName: typeof data.fileName === "string" ? data.fileName : "document.docx",
      updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
    });
  } catch {
    return null;
  }
}

export function createAutosave({
  storage = globalThis.localStorage,
  key = AUTOSAVE_KEY,
  debounceMs = 400,
} = {}) {
  let timer = null;

  function load() {
    try {
      return parseAutosave(storage?.getItem?.(key));
    } catch {
      return null;
    }
  }

  function save(payload) {
    try {
      storage?.setItem?.(key, serializeAutosave(payload));
      return true;
    } catch {
      return false;
    }
  }

  function schedule(payload) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      save(payload);
    }, debounceMs);
  }

  function flush(payload) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    return save(payload);
  }

  function clear() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    try {
      storage?.removeItem?.(key);
    } catch {
      /* ignore */
    }
  }

  return { load, save, schedule, flush, clear };
}
