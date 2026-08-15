/**
 * Full-document preview for the compact single-line editor.
 *
 * The editor itself only claims one line of space, so this panel is where the
 * whole document can be read — either rendered or as raw Markdown.
 */

const MODES = { RENDERED: "rendered", MARKDOWN: "markdown" };

export function createPreview({
  card,
  body,
  toggleButton,
  modesEl,
  countEl,
  editor,
}) {
  let open = false;
  let mode = MODES.RENDERED;

  function renderCount() {
    if (!countEl) return;
    const characters = [...editor.text].length;
    const words = editor.text.split(/\s+/).filter(Boolean).length;
    countEl.textContent = `${words} words · ${characters} characters`;
  }

  function render() {
    if (!open || !body) return;

    if (mode === MODES.MARKDOWN) {
      const pre = document.createElement("pre");
      pre.className = "preview-markdown";
      pre.dir = "ltr";
      pre.textContent = editor.getMarkdown();
      body.replaceChildren(pre);
    } else {
      const article = document.createElement("div");
      article.className = "preview-rendered tiptap";
      article.lang = "ks";
      article.dir = "rtl";
      // Source is the editor's own schema-validated output, not user HTML.
      article.innerHTML = editor.getHTML();
      body.replaceChildren(article);
    }

    renderCount();
  }

  function setMode(next) {
    mode = next === MODES.MARKDOWN ? MODES.MARKDOWN : MODES.RENDERED;
    modesEl?.querySelectorAll("[data-preview]").forEach((button) => {
      const active = button.dataset.preview === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    render();
  }

  function setOpen(next) {
    open = Boolean(next);
    if (card) card.hidden = !open;
    toggleButton?.classList.toggle("active", open);
    toggleButton?.setAttribute("aria-expanded", String(open));
    if (open) render();
    else body?.replaceChildren();
  }

  function init() {
    toggleButton?.addEventListener("click", () => setOpen(!open));
    modesEl?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-preview]");
      if (!button) return;
      setMode(button.dataset.preview);
    });
    setOpen(false);
  }

  return {
    init,
    render,
    setOpen,
    get isOpen() {
      return open;
    },
    get mode() {
      return mode;
    },
  };
}
