import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { createMenuVisibility, MENU_VISIBILITY_KEY } from "../src/ui/menu-visibility.js";

function setup(savedValue) {
  const window = new Window();
  const app = window.document.createElement("main");
  const button = window.document.createElement("button");
  const values = new Map();
  if (savedValue) values.set(MENU_VISIBILITY_KEY, savedValue);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const visibility = createMenuVisibility({ app, button, storage });
  return { app, button, values, visibility };
}

describe("menu visibility", () => {
  it("starts expanded by default", () => {
    const { app, button, visibility } = setup();
    visibility.init();

    assert.equal(visibility.isMinimal, false);
    assert.equal(app.classList.contains("minimal-ui"), false);
    assert.equal(button.textContent, "Hide menus");
    assert.equal(button.getAttribute("aria-expanded"), "true");
  });

  it("hides menus and persists the preference", () => {
    const { app, button, values, visibility } = setup();
    visibility.init();
    button.click();

    assert.equal(visibility.isMinimal, true);
    assert.equal(app.classList.contains("minimal-ui"), true);
    assert.equal(button.textContent, "Show menus");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(values.get(MENU_VISIBILITY_KEY), "minimal");
  });

  it("restores minimal mode and can show menus again", () => {
    const { app, button, values, visibility } = setup("minimal");
    visibility.init();
    assert.equal(app.classList.contains("minimal-ui"), true);

    button.click();
    assert.equal(app.classList.contains("minimal-ui"), false);
    assert.equal(values.get(MENU_VISIBILITY_KEY), "full");
  });
});
