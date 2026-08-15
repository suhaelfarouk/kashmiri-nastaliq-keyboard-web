export const MENU_VISIBILITY_KEY = "makhzan-minimal-ui-v1";

/**
 * Toggle optional controls while keeping the editor, preview button, and
 * keyboard available. The preference is local to this browser.
 */
export function createMenuVisibility({
  app,
  button,
  storage = globalThis.localStorage,
  key = MENU_VISIBILITY_KEY,
} = {}) {
  let minimal = false;

  function save() {
    try {
      storage?.setItem?.(key, minimal ? "minimal" : "full");
    } catch {
      /* The UI still works when storage is unavailable. */
    }
  }

  function render() {
    app?.classList.toggle("minimal-ui", minimal);
    if (!button) return;
    button.textContent = minimal ? "Show menus" : "Hide menus";
    button.setAttribute("aria-expanded", String(!minimal));
  }

  function setMinimal(next, { persist = true } = {}) {
    minimal = Boolean(next);
    render();
    if (persist) save();
  }

  function init() {
    try {
      minimal = storage?.getItem?.(key) === "minimal";
    } catch {
      minimal = false;
    }
    render();
    button?.addEventListener("click", () => setMinimal(!minimal));
  }

  return {
    init,
    setMinimal,
    get isMinimal() {
      return minimal;
    },
  };
}
