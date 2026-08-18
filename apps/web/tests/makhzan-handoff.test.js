import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { createMakhzanHandoff } from "../src/ui/makhzan-handoff.js";

describe("Makhzan handoff", () => {
  it("stays inactive without from=makhzan", () => {
    const window = new Window({ url: "https://example.com/" });
    const handoff = createMakhzanHandoff({
      root: window.document,
      win: window,
      editor: { insertText() {} },
    });
    assert.equal(handoff.fromMakhzan, false);
  });

  it("shows banner and pastes clipboard text on click", async () => {
    const window = new Window({
      url: "https://example.com/?from=makhzan",
    });
    window.document.body.innerHTML = `
      <div id="makhzanHandoffBanner" hidden>
        <button id="pasteMakhzanBtn" type="button">Paste from Makhzan</button>
      </div>
      <span id="status"></span>
    `;

    let pasted = null;
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => "کٲشُر",
      },
    });

    const handoff = createMakhzanHandoff({
      root: window.document,
      win: window,
      editor: {
        insertText(text) {
          pasted = text;
        },
        focus() {},
        updateStatus() {},
      },
      statusEl: window.document.querySelector("#status"),
    });
    handoff.init();

    const banner = window.document.querySelector("#makhzanHandoffBanner");
    assert.equal(banner.hidden, false);

    window.document.querySelector("#pasteMakhzanBtn").click();
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(pasted, "کٲشُر");
    assert.equal(banner.hidden, true);
    assert.equal(window.location.search.includes("from=makhzan"), false);
  });
});
