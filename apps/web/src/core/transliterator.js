import { PHONETIC_RULES, COMBINING_MARKS, MAX_BUFFER_LENGTH } from "../data/transliteration.js";

/**
 * Pure buffered longest-match phonetic engine. No DOM access.
 *
 * Usage:
 *   const t = createTransliterator();
 *   t.add("k");           // may emit nothing yet
 *   t.add("a");           // emits "کَ" when unambiguous, etc.
 *   const out = t.commit(); // flush remaining buffer
 */
export function createTransliterator(rules = PHONETIC_RULES) {
  let buffer = "";
  let atWordStart = true;

  function resolveTarget(target) {
    if (typeof target === "string") return target;
    return atWordStart ? target.initial : target.medial;
  }

  function append(target) {
    const text = resolveTarget(target);
    if (text) atWordStart = false;
    return text;
  }

  function findExact(s) {
    return rules.find(([latin]) => latin === s);
  }

  function hasPrefix(s) {
    return rules.some(([latin]) => latin.startsWith(s));
  }

  function hasLonger(s) {
    return rules.some(([latin]) => latin !== s && latin.startsWith(s));
  }

  /**
   * Consume the Latin buffer.
   * @param {boolean} force  If true, emit even when the buffer is still a valid prefix.
   * @returns {string} Emitted Kashmiri text (may be empty).
   */
  function resolve(force = false) {
    let emitted = "";

    while (buffer) {
      if (!force && hasPrefix(buffer)) {
        const exact = findExact(buffer);
        if (exact && !hasLonger(buffer)) {
          emitted += append(exact[1]);
          buffer = "";
        }
        return emitted;
      }

      let best = null;
      for (const [latin, target] of rules) {
        if (buffer.startsWith(latin) && (!best || latin.length > best[0].length)) {
          best = [latin, target];
        }
      }

      if (best) {
        emitted += append(best[1]);
        buffer = buffer.slice(best[0].length);
        continue;
      }

      // Unknown Latin character: preserve it rather than silently dropping it.
      emitted += buffer[0];
      atWordStart = false;
      buffer = buffer.slice(1);
    }

    return emitted;
  }

  return {
    /** Current pending Latin buffer (read-only snapshot). */
    getBuffer() {
      return buffer;
    },

    /** Whether the next emitted character begins a new word. */
    isAtWordStart() {
      return atWordStart;
    },

    /**
     * Append a Latin character and resolve what can be committed.
     * @param {string} ch
     * @returns {string} Emitted Kashmiri text.
     */
    add(ch) {
      buffer += ch.toLowerCase();
      return resolve(buffer.length > MAX_BUFFER_LENGTH);
    },

    /**
     * Insert a combining mark, flushing the buffer first.
     * @param {string} mark
     * @returns {string}
     */
    addMark(mark) {
      const prefix = resolve(true);
      if (mark) atWordStart = false;
      return prefix + mark;
    },

    /**
     * Force-commit the entire buffer.
     * @returns {string}
     */
    commit() {
      const out = resolve(true);
      buffer = "";
      return out;
    },

    /**
     * Delete the last Latin character from the buffer.
     * @returns {boolean} True if a buffered character was removed.
     */
    backspace() {
      if (!buffer) return false;
      buffer = buffer.slice(0, -1);
      return true;
    },

    /** Mark the next phonetic sequence as word-initial. */
    wordBoundary() {
      buffer = "";
      atWordStart = true;
    },

    /** Clear the buffer without emitting. */
    reset() {
      buffer = "";
      atWordStart = true;
    },

    /**
     * Handle a single key character in phonetic mode.
     * Returns { handled, text } — handled is false for non-phonetic keys.
     * @param {string} key
     */
    handleKey(key) {
      if (COMBINING_MARKS[key]) {
        // `a~` is a contextual vowel sequence; other special keys remain
        // direct combining-mark commands.
        if (hasPrefix(buffer + key)) {
          return { handled: true, text: this.add(key) };
        }
        return { handled: true, text: this.addMark(COMBINING_MARKS[key]) };
      }
      if (/[A-Za-z']/.test(key)) {
        return { handled: true, text: this.add(key) };
      }
      return { handled: false, text: "" };
    },
  };
}
