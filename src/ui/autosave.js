/**
 * Versioned localStorage autosave for Markdown + font metadata.
 */

export const AUTOSAVE_KEY = "ks-nastaliq-editor-v1";
export const AUTOSAVE_VERSION = 1;

export function createAutosavePayload({
  markdown = "",
  fontPresetId,
  fontSize,
  fileName = "document.md",
  updatedAt = Date.now(),
} = {}) {
  return {
    version: AUTOSAVE_VERSION,
    markdown,
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
    if (data.version !== AUTOSAVE_VERSION) return null;
    return createAutosavePayload({
      markdown: typeof data.markdown === "string" ? data.markdown : "",
      fontPresetId: data.fontPresetId,
      fontSize: typeof data.fontSize === "number" ? data.fontSize : undefined,
      fileName: typeof data.fileName === "string" ? data.fileName : "document.md",
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
