/**
 * Read-only, distraction-free view of the document.
 *
 * The editor is already a full WYSIWYG surface, so this panel renders the
 * exact same content without the toolbars and keyboard \u2014 useful for a clean
 * read before sharing or printing. There is no separate "raw" view: what you
 * see here (and when printing) always matches what you see in the editor.
 */
export function createPreview({ card, body, toggleButton, countEl, editor }) {
  let open = false;

  function renderCount() {
    if (!countEl) return;
    const characters = [...editor.text].length;
    const words = editor.text.split(/\s+/).filter(Boolean).length;
    countEl.textContent = `${words} words \u00b7 ${characters} characters`;
  }

  function render() {
    if (!open || !body) return;

    const article = document.createElement("div");
    article.className = "preview-rendered tiptap";
    article.lang = "ks";
    article.dir = "rtl";
    // Source is the editor's own schema-validated output, not user HTML.
    article.innerHTML = editor.getHTML();
    body.replaceChildren(article);

    renderCount();
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
    setOpen(false);
  }

  return {
    init,
    render,
    setOpen,
    get isOpen() {
      return open;
    },
  };
}
