import { Editor } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";

/**
 * UTF-16 length of the last Unicode code point in `text`.
 * Used so Kashmiri combining marks delete separately from their base letter.
 */
function lastCodePointUtf16Length(text) {
  if (!text) return 0;
  const points = [...text];
  return points[points.length - 1].length;
}

/**
 * Tiptap-backed WYSIWYG editor. The document is HTML/JSON in memory;
 * Word .docx is the Open/Download interchange format.
 */
export function createEditor({
  element,
  statusEl,
  getModeLabel,
  initialHTML = "",
  placeholder = "یِتھ کٔنہٕ کٲشُری لیکھو...",
  onUpdate,
  onSelectionUpdate,
  handleKeyDown,
}) {
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { dir: "ltr" } },
        code: { HTMLAttributes: { dir: "ltr" } },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialHTML || "",
    editorProps: {
      attributes: {
        lang: "ks",
        dir: "rtl",
        class: "tiptap ProseMirror",
        spellcheck: "false",
      },
      handleKeyDown(_view, event) {
        if (!handleKeyDown) return false;
        handleKeyDown(event);
        return event.defaultPrevented;
      },
    },
    onUpdate: ({ editor: current }) => {
      updateStatus();
      onUpdate?.(current);
    },
    onSelectionUpdate: ({ editor: current }) => {
      onSelectionUpdate?.(current);
    },
  });

  function updateStatus(message) {
    if (!statusEl) return;
    if (message) {
      statusEl.textContent = message;
      return;
    }
    const mode = getModeLabel?.() ?? "Direct";
    const count = [...editor.getText()].length;
    statusEl.textContent = `${mode} · ${count} characters`;
  }

  function insertText(text) {
    if (!text) return;
    editor.chain().focus().insertContent(text).run();
    updateStatus();
  }

  function backspace() {
    const { state } = editor;
    const { from, empty } = state.selection;

    if (!empty) {
      editor.chain().focus().deleteSelection().run();
      updateStatus();
      return;
    }

    if (from <= 1) return;

    const $from = state.selection.$from;
    const lookBehind = Math.min($from.parentOffset, 32);
    const textBefore = $from.parent.textBetween(
      $from.parentOffset - lookBehind,
      $from.parentOffset,
      undefined,
      "\ufffc",
    );

    if (!textBefore) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: from - 1, to: from })
        .run();
      updateStatus();
      return;
    }

    const deleteLen = lastCodePointUtf16Length(textBefore);
    editor
      .chain()
      .focus()
      .deleteRange({ from: from - deleteLen, to: from })
      .run();
    updateStatus();
  }

  function clear() {
    editor.commands.clearContent(true);
    editor.commands.focus();
    updateStatus();
  }

  function getHTML() {
    return editor.getHTML();
  }

  function getJSON() {
    return editor.getJSON();
  }

  function setHTML(html, { emitUpdate = true } = {}) {
    editor.commands.setContent(html ?? "", { emitUpdate });
    updateStatus();
  }

  async function copy() {
    const text = editor.getText();
    const html = getHTML();
    try {
      if (globalThis.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      updateStatus("Copied");
    } catch {
      updateStatus("Select and copy manually");
    }
    setTimeout(() => updateStatus(), 1200);
  }

  /**
   * Apply document typography on the document root so the editor, preview,
   * and print view stay in sync. Named in exported .docx files; not embedded.
   */
  function setTypography({ cssFamily, lineHeight, fontSize } = {}) {
    const host = element.ownerDocument?.documentElement ?? element;
    if (cssFamily) host.style.setProperty("--editor-font", cssFamily);
    if (lineHeight) host.style.setProperty("--editor-leading", String(lineHeight));
    if (fontSize) host.style.setProperty("--editor-size", `${fontSize}px`);
  }

  return {
    insertText,
    backspace,
    clear,
    copy,
    updateStatus,
    getHTML,
    getJSON,
    setHTML,
    setTypography,
    get value() {
      return getHTML();
    },
    get text() {
      return editor.getText();
    },
    get json() {
      return getJSON();
    },
    get dom() {
      return editor.view.dom;
    },
    get tiptap() {
      return editor;
    },
    focus() {
      editor.commands.focus();
    },
    destroy() {
      editor.destroy();
    },
  };
}
