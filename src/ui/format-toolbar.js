/**
 * Compact formatting toolbar for the Tiptap editor.
 */

const ACTIONS = [
  { id: "paragraph", label: "P", title: "Paragraph", run: (e) => e.chain().focus().setParagraph().run(), active: (e) => e.isActive("paragraph") },
  { id: "heading1", label: "H1", title: "Heading 1", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), active: (e) => e.isActive("heading", { level: 1 }) },
  { id: "heading2", label: "H2", title: "Heading 2", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive("heading", { level: 2 }) },
  { id: "heading3", label: "H3", title: "Heading 3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive("heading", { level: 3 }) },
  { type: "separator" },
  { id: "bold", label: "B", title: "Bold", run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive("bold") },
  { id: "italic", label: "I", title: "Italic", run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive("italic") },
  { id: "strike", label: "S", title: "Strikethrough", run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive("strike") },
  { id: "code", label: "</>", title: "Inline code", run: (e) => e.chain().focus().toggleCode().run(), active: (e) => e.isActive("code") },
  { type: "separator" },
  { id: "bullet", label: "• List", title: "Bullet list", run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive("bulletList") },
  { id: "ordered", label: "1. List", title: "Ordered list", run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive("orderedList") },
  { id: "quote", label: "❝", title: "Blockquote", run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive("blockquote") },
  { id: "codeBlock", label: "{ }", title: "Code block", run: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive("codeBlock") },
  { id: "hr", label: "—", title: "Horizontal rule", run: (e) => e.chain().focus().setHorizontalRule().run(), active: () => false },
  { type: "separator" },
  {
    id: "link",
    label: "Link",
    title: "Add or edit link",
    run: (e) => {
      const previous = e.getAttributes("link").href ?? "";
      const href = window.prompt("Link URL", previous);
      if (href === null) return;
      if (href === "") {
        e.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      e.chain().focus().extendMarkRange("link").setLink({ href }).run();
    },
    active: (e) => e.isActive("link"),
  },
  { id: "unlink", label: "Unlink", title: "Remove link", run: (e) => e.chain().focus().unsetLink().run(), active: () => false },
  { type: "separator" },
  { id: "undo", label: "Undo", title: "Undo", run: (e) => e.chain().focus().undo().run(), active: () => false },
  { id: "redo", label: "Redo", title: "Redo", run: (e) => e.chain().focus().redo().run(), active: () => false },
];

export function createFormatToolbar({ root, getEditor }) {
  function render() {
    if (!root) return;
    root.replaceChildren();
    for (const action of ACTIONS) {
      if (action.type === "separator") {
        const sep = document.createElement("span");
        sep.className = "format-separator";
        sep.setAttribute("aria-hidden", "true");
        root.appendChild(sep);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "format-button";
      button.dataset.action = action.id;
      button.title = action.title;
      button.setAttribute("aria-label", action.title);
      button.textContent = action.label;
      if (action.id === "bold") button.style.fontWeight = "700";
      if (action.id === "italic") button.style.fontStyle = "italic";
      if (action.id === "strike") button.style.textDecoration = "line-through";
      root.appendChild(button);
    }
  }

  function sync() {
    const editor = getEditor?.();
    if (!root || !editor) return;
    root.querySelectorAll("button[data-action]").forEach((button) => {
      const action = ACTIONS.find((item) => item.id === button.dataset.action);
      if (!action || action.type === "separator") return;
      button.classList.toggle("active", Boolean(action.active?.(editor)));
    });
  }

  function bind() {
    root?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button || !root.contains(button)) return;
      const action = ACTIONS.find((item) => item.id === button.dataset.action);
      const editor = getEditor?.();
      if (!action || !editor) return;
      action.run(editor);
      sync();
    });
  }

  function init() {
    render();
    bind();
    sync();
  }

  return { init, sync };
}
