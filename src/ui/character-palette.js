import { CHARACTER_GROUPS } from "../data/characters.js";
import { markPlacement } from "../data/marks.js";

function codePointLabel(text) {
  return [...text]
    .map((character) => `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" + ");
}

/**
 * Render the extended character palette and insert clicked values.
 */
export function createCharacterPalette({ root, editor, beforeInsert }) {
  function renderItem(definition) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "character-button";
    button.lang = "ks";
    button.dataset.value = definition.value;
    button.title = `${definition.name} · ${codePointLabel(definition.value)}`;

    // A bare mark is wrapped so it can be nudged back inside the button.
    const placement = markPlacement(definition.value);
    const face = document.createElement("span");
    face.className = placement ? `glyph face-${placement}` : "glyph";
    face.textContent = definition.preview;
    button.appendChild(face);

    button.setAttribute("aria-label", definition.name);
    return button;
  }

  function renderGroup(group) {
    const section = document.createElement("section");
    section.className = "character-group";
    section.setAttribute("aria-labelledby", `character-group-${group.id}`);

    const heading = document.createElement("h3");
    heading.id = `character-group-${group.id}`;
    heading.textContent = group.label;

    const grid = document.createElement("div");
    grid.className = "character-grid";
    grid.append(...group.items.map(renderItem));

    section.append(heading, grid);
    return section;
  }

  function init() {
    root.replaceChildren(...CHARACTER_GROUPS.map(renderGroup));
    root.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]");
      if (!button || !root.contains(button)) return;
      beforeInsert?.();
      editor.insertText(button.dataset.value);
    });
  }

  return { init };
}

