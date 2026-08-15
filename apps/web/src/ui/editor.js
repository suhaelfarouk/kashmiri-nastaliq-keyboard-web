import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";

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
 * Tiptap-backed editor that keeps the caret API used by the keyboard/palette.
 */
export function createEditor({
  element,
  statusEl,
  getModeLabel,
  initialMarkdown = "",
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
      Markdown.configure({
        indentation: { style: "space", size: 2 },
        markedOptions: { gfm: true, breaks: false },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialMarkdown || "",
    contentType: "markdown",
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
    const { from, to, empty } = state.selection;

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
      "\ufffc"
    );

    if (!textBefore) {
      editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
      updateStatus();
      return;
    }

    const deleteLen = lastCodePointUtf16Length(textBefore);
    editor.chain().focus().deleteRange({ from: from - deleteLen, to: from }).run();
    updateStatus();
  }

  function clear() {
    editor.commands.clearContent(true);
    editor.commands.focus();
    updateStatus();
  }

  function getMarkdown() {
    return editor.getMarkdown?.() ?? "";
  }

  function getHTML() {
    return editor.getHTML();
  }

  function setMarkdown(markdown, { emitUpdate = true } = {}) {
    editor.commands.setContent(markdown ?? "", {
      contentType: "markdown",
      emitUpdate,
    });
    updateStatus();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(getMarkdown());
      updateStatus("Copied Markdown");
    } catch {
      updateStatus("Select and copy manually");
    }
    setTimeout(() => updateStatus(), 1200);
  }

  /**
   * Apply document typography (never to the Markdown). Set on the document root
   * so the editor and the preview panel stay in sync.
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
    getMarkdown,
    getHTML,
    setMarkdown,
    setTypography,
    get value() {
      return getMarkdown();
    },
    get text() {
      return editor.getText();
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
