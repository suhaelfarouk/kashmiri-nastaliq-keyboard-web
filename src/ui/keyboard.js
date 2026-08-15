import {
  KEYBOARD_ROWS,
  KEY_BY_CODE,
  KEY_CODES,
  LAYERS,
  LAYER_LABELS,
  faceDisplay,
  isCharacterKey,
  keyFaces,
  layerFor,
  resolveKeyChar,
} from "../data/keyboard.js";

const FACE_CLASS = {
  [LAYERS.BASE]: "face-base",
  [LAYERS.SHIFT]: "face-shift",
  [LAYERS.ALT]: "face-alt",
  [LAYERS.ALT_SHIFT]: "face-alt-shift",
};

const SHIFT_CODES = new Set(["ShiftLeft", "ShiftRight"]);
const ALT_CODES = new Set(["AltLeft", "AltRight"]);

/**
 * Render and drive the on-screen keyboard + physical key mapping.
 */
export function createKeyboard({
  root,
  layerStatusEl,
  layerSelectEl,
  transliterator,
  editor,
  getMode,
  isPhysicalEnabled,
}) {
  // The layer chosen with the on-screen selector; physical modifiers override
  // it while held, and a one-shot on-screen modifier lasts for one character.
  let stickyLayer = LAYERS.BASE;
  let activeLayer = LAYERS.BASE;
  let oneShot = false;
  let physicalShift = false;
  let physicalAlt = false;

  function applyLayer(layer) {
    activeLayer = layer;
    const shift = layer === LAYERS.SHIFT || layer === LAYERS.ALT_SHIFT;
    const alt = layer === LAYERS.ALT || layer === LAYERS.ALT_SHIFT;

    root.classList.toggle("shift-active", shift);
    root.classList.toggle("alt-active", alt);

    const shiftBtn = root.querySelector(`[data-code="${KEY_CODES.SHIFT}"]`);
    if (shiftBtn) {
      shiftBtn.classList.toggle("active", shift);
      shiftBtn.setAttribute("aria-pressed", String(shift));
    }

    const altBtn = root.querySelector(`[data-code="${KEY_CODES.ALT}"]`);
    if (altBtn) {
      altBtn.classList.toggle("active", alt);
      altBtn.setAttribute("aria-pressed", String(alt));
    }

    if (layerStatusEl) layerStatusEl.textContent = LAYER_LABELS[layer];

    layerSelectEl?.querySelectorAll("[data-layer]").forEach((button) => {
      const selected = button.dataset.layer === layer;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  /** Restore whatever layer the modifiers and selector imply right now. */
  function syncLayer() {
    if (physicalShift || physicalAlt) {
      applyLayer(layerFor({ shift: physicalShift, alt: physicalAlt }));
      return;
    }
    applyLayer(stickyLayer);
  }

  function setLayer(layer) {
    stickyLayer = layer;
    oneShot = false;
    syncLayer();
  }

  /** Toggle a modifier from the on-screen keyboard; lasts one character. */
  function toggleOneShot(modifier) {
    const shift = activeLayer === LAYERS.SHIFT || activeLayer === LAYERS.ALT_SHIFT;
    const alt = activeLayer === LAYERS.ALT || activeLayer === LAYERS.ALT_SHIFT;
    const next = layerFor({
      shift: modifier === "shift" ? !shift : shift,
      alt: modifier === "alt" ? !alt : alt,
    });
    oneShot = next !== stickyLayer;
    applyLayer(next);
  }

  function releaseOneShot() {
    if (!oneShot || physicalShift || physicalAlt) return;
    oneShot = false;
    applyLayer(stickyLayer);
  }

  function emit(text) {
    if (!text) return;
    editor.insertText(text);
    if (/[\s.,!?;:،؛؟۔]/u.test(text)) transliterator.wordBoundary();
    releaseOneShot();
  }

  function flushTranslit() {
    const text = transliterator.commit();
    if (text) editor.insertText(text);
  }

  function setDualLayer(active) {
    root.classList.toggle("dual-layer", active);
  }

  function renderKey(def) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.code = def.code;
    button.dataset.label = def.label;

    const modifier = {
      space: { className: "key key-space", text: "Space" },
      shift: { className: "key key-modifier key-shift", text: "Shift" },
      alt: { className: "key key-modifier key-alt", text: "Alt" },
      backspace: { className: "key key-backspace", text: "⌫", label: "Backspace" },
    }[def.type];

    if (modifier) {
      button.className = modifier.className;
      button.textContent = modifier.text;
      if (modifier.label) button.setAttribute("aria-label", modifier.label);
      if (def.type === "shift" || def.type === "alt") {
        button.setAttribute("aria-pressed", "false");
      }
      return button;
    }

    button.className = "key";
    button.lang = "ks";

    const faces = keyFaces(def);
    button.classList.toggle("same-face", faces[LAYERS.SHIFT] === faces[LAYERS.BASE]);

    for (const layer of Object.values(LAYERS)) {
      const { text, kind } = faceDisplay(faces[layer]);
      const span = document.createElement("span");
      span.className = FACE_CLASS[layer];
      if (kind !== "text") span.classList.add(`face-${kind}`);
      span.textContent = text;
      button.appendChild(span);
    }

    return button;
  }

  function render() {
    root.replaceChildren(
      ...KEYBOARD_ROWS.map((row) => {
        const rowEl = document.createElement("div");
        rowEl.className = "row";
        rowEl.append(...row.map(renderKey));
        return rowEl;
      })
    );
  }

  function deleteBackwards() {
    if (transliterator.backspace()) editor.updateStatus();
    else editor.backspace();
  }

  function handleKeyClick(code) {
    if (code === KEY_CODES.SHIFT) {
      toggleOneShot("shift");
      return;
    }
    if (code === KEY_CODES.ALT) {
      toggleOneShot("alt");
      return;
    }
    if (code === KEY_CODES.BACKSPACE) {
      deleteBackwards();
      return;
    }

    flushTranslit();
    emit(code === KEY_CODES.SPACE ? " " : resolveKeyChar(code, activeLayer));
  }

  function bindClicks() {
    root.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-code]");
      if (!button || !root.contains(button)) return;
      handleKeyClick(button.dataset.code);
    });

    layerSelectEl?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-layer]");
      if (!button) return;
      setLayer(button.dataset.layer === stickyLayer ? LAYERS.BASE : button.dataset.layer);
    });
  }

  function handlePhysicalKeydown(event) {
    if (SHIFT_CODES.has(event.code)) {
      physicalShift = true;
      syncLayer();
      return;
    }
    if (ALT_CODES.has(event.code)) {
      physicalAlt = true;
      syncLayer();
      return;
    }

    if (!isPhysicalEnabled()) return;
    if (event.ctrlKey || event.metaKey) return;

    if (event.code === KEY_CODES.SPACE) {
      event.preventDefault();
      flushTranslit();
      emit(" ");
      return;
    }

    if (event.code === KEY_CODES.BACKSPACE) {
      event.preventDefault();
      deleteBackwards();
      return;
    }

    const key = KEY_BY_CODE[event.code];

    // Any modifier layer bypasses phonetic buffering and types directly.
    if (event.shiftKey || event.altKey) {
      if (!isCharacterKey(key)) return;
      const character = resolveKeyChar(
        event.code,
        layerFor({ shift: event.shiftKey, alt: event.altKey })
      );
      if (!character) {
        // Unassigned layer slot: swallow the keystroke rather than letting the
        // browser insert the Latin/Option character underneath it.
        if (event.altKey) event.preventDefault();
        return;
      }
      event.preventDefault();
      flushTranslit();
      emit(character);
      return;
    }

    if (getMode() === "phonetic" && event.key.length === 1) {
      const { handled, text } = transliterator.handleKey(event.key);
      if (handled) {
        event.preventDefault();
        if (text) editor.insertText(text);
        return;
      }
    }

    if (isCharacterKey(key)) {
      const character = resolveKeyChar(event.code, LAYERS.BASE);
      if (character) {
        event.preventDefault();
        flushTranslit();
        emit(character);
      }
    }
  }

  function handlePhysicalKeyup(event) {
    if (SHIFT_CODES.has(event.code)) {
      physicalShift = false;
      syncLayer();
      return;
    }
    if (ALT_CODES.has(event.code)) {
      physicalAlt = false;
      syncLayer();
    }
  }

  function resetModifiers() {
    physicalShift = false;
    physicalAlt = false;
    oneShot = false;
    syncLayer();
  }

  function init() {
    render();
    bindClicks();
    setDualLayer(false);
    applyLayer(LAYERS.BASE);
  }

  return {
    init,
    setLayer,
    setDualLayer,
    resetModifiers,
    handlePhysicalKeydown,
    handlePhysicalKeyup,
    flushTranslit,
    get activeLayer() {
      return activeLayer;
    },
  };
}
