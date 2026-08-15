/**
 * User-initiated clipboard paste when opened from the Makhzan companion
 * via `?from=makhzan`. Browsers require a click (and HTTPS) for clipboard read.
 */
export function createMakhzanHandoff({
  root = document,
  editor,
  beforePaste,
  statusEl,
  win = typeof window !== "undefined" ? window : undefined,
} = {}) {
  const targetWindow = win ?? globalThis;
  const params = new URLSearchParams(targetWindow.location.search);
  const fromMakhzan = params.get("from") === "makhzan";

  let banner;
  let pasteBtn;

  function init() {
    if (!fromMakhzan) return;

    banner = root.querySelector("#makhzanHandoffBanner");
    pasteBtn = root.querySelector("#pasteMakhzanBtn");
    if (!banner || !pasteBtn) return;

    banner.hidden = false;
    pasteBtn.addEventListener("click", onPaste);
  }

  async function onPaste() {
    beforePaste?.();
    try {
      const clipboard = targetWindow.navigator?.clipboard;
      if (!clipboard?.readText) {
        throw new Error("Clipboard API unavailable");
      }
      const text = await clipboard.readText();
      if (!text?.trim()) {
        setStatus("Clipboard is empty — copy again from Makhzan");
        return;
      }
      editor?.insertText(text.trim());
      editor?.focus?.();
      setStatus("Pasted from Makhzan");
      banner.hidden = true;
      const url = new URL(targetWindow.location.href);
      url.searchParams.delete("from");
      targetWindow.history.replaceState({}, "", url.pathname + url.search + url.hash);
      setTimeout(() => setStatus(), 1400);
    } catch {
      setStatus("Allow clipboard access, or paste manually (⌘/Ctrl+V)");
      setTimeout(() => setStatus(), 2200);
    }
  }

  function setStatus(message) {
    if (!statusEl) return;
    if (message) statusEl.textContent = message;
    else editor?.updateStatus?.();
  }

  return { init, fromMakhzan };
}
