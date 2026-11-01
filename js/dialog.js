// =============================================================================
// DIALOGUE
// =============================================================================

class Dialog {
    /**
     * @param {Array} lines - {who, text, hint} entries, see CHARACTERS. A hint is a
     *   note about the controls, shown under the line in the player's own terms.
     * @param {Function} onDone - Called after the last line
     */
    constructor(lines, onDone) {
        this.lines = lines.map(line => ({
            ...line,
            text: Prompts.fill(line.text),
            hint: line.hint ? Prompts.fill(line.hint) : null
        }));
        this.onDone = onDone;
        this.index = 0;
        this.shown = 0;
        this.charsPerMs = 0.05;
    }

    get line() {
        return this.lines[this.index];
    }

    get finishedTyping() {
        return this.shown >= this.line.text.length;
    }

    update(deltaTime) {
        if (this.finishedTyping) return;
        const before = Math.floor(this.shown);
        this.shown = Math.min(this.line.text.length, this.shown + deltaTime * this.charsPerMs);
        if (Math.floor(this.shown) !== before && before % 3 === 0) window.audioSystem.dialogBlip();
    }

    /**
     * First press finishes the line, the next one moves on
     */
    advance() {
        if (!this.finishedTyping) {
            this.shown = this.line.text.length;
            return;
        }
        window.audioSystem.select();
        this.index++;
        this.shown = 0;
        if (this.index >= this.lines.length) {
            if (window.game) window.game.dialog = null;
            if (this.onDone) this.onDone();
        }
    }
}

window.Dialog = Dialog;
