// =============================================================================
// WORLD MAP
// =============================================================================
// The Old Grand seen from above with its lid off: the keyboard down the left, the
// strings running out to the tail, and the road a note walks drawn across it. The
// road leaves the keys, goes out along the strings and comes back under them to
// the far end of the keyboard. Parts of the piano stay dim until they are mended.

// Where each stage sits, as fractions of the piano's length and width
const MAP_SPOTS = {
    '1-1': [0.055, 0.46], '1-2': [0.055, 0.66], '1-S': [0.02, 0.8], '1-B': [0.125, 0.56],
    '2-1': [0.19, 0.44], '2-2': [0.3, 0.3], '2-S': [0.3, 0.1], '2-B': [0.42, 0.2],
    '3-1': [0.52, 0.32], '3-2': [0.6, 0.42], '3-S': [0.66, 0.22], '3-B': [0.71, 0.33],
    '4-1': [0.84, 0.3], '4-S': [0.83, 0.5], '4-2': [0.62, 0.62], '4-B': [0.055, 0.92]
};

// Which stage's boss mends each region, and the span of the piano it covers
const MAP_REGIONS = [
    { start: 0.115, end: 0.17, boss: '1-B' },  // Hammers
    { start: 0.17, end: 0.47, boss: '2-B' },   // Strings
    { start: 0.47, end: 0.76, boss: '3-B' },   // Dampers
    { start: 0.76, end: 1, boss: '4-2' }       // Bridge and board
];

class WorldMap {
    constructor(canvas, onSelect) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onSelect = onSelect;
        this.levels = campaignLevels();
        this.selected = 0;
        this.nodes = [];
        this.pip = null;
        this.running = false;
        this.time = 0;
    }

    /**
     * Show the map, with Pip setting off from the last stage toward the next
     * @param {string} levelId - Stage to select
     * @param {string} fromId - Where Pip was last
     */
    start(levelId, fromId) {
        this.resize();
        const from = this.levels.find(level => level.id === fromId);
        this.pip = from ? { ...this.nodeFor(from) } : null;
        const index = this.levels.findIndex(level => level.id === levelId);
        this.select(index >= 0 ? index : this.furthestOpen(), !from);
        if (!this.running) {
            this.running = true;
            this.loop(performance.now());
        }
    }

    stop() {
        this.running = false;
    }

    furthestOpen() {
        let last = 0;
        this.levels.forEach((level, i) => {
            if (CampaignSave.isOpen(level) && !CampaignSave.isComplete(level.id)) last = Math.max(last, i);
        });
        return last;
    }

    resize() {
        const box = this.canvas.parentElement.getBoundingClientRect();
        const scale = Math.max(2, Math.round(box.height / 240));
        this.canvas.width = Math.ceil(box.width / scale);
        this.canvas.height = Math.ceil(box.height / scale);
        this.scale = scale;
        this.frame = {
            left: 14,
            right: this.canvas.width - 14,
            top: 26,
            bottom: this.canvas.height - 12
        };
        this.nodes = this.levels.map(level => {
            const [u, v] = MAP_SPOTS[level.id];
            return { id: level.id, x: this.spotX(u), y: this.spotY(v) };
        });
        this.background = this.paintBackground();
    }

    spotX(u) {
        return Math.round(this.frame.left + (this.frame.right - this.frame.left) * u);
    }

    spotY(v) {
        return Math.round(this.frame.top + (this.frame.bottom - this.frame.top) * v);
    }

    nodeFor(level) {
        return this.nodes.find(node => node.id === level.id);
    }

    /**
     * The piano's outline. The side at the top is straight, and the long curve of
     * the case sweeps in along the bottom to the tail.
     * @param {number} u - Fraction along the length of the piano
     * @returns {{top:number,bottom:number}} Fractions across its width
     */
    outline(u) {
        const ease = t => t * t * (3 - 2 * t);
        const sweep = ease(Math.max(0, Math.min(1, (u - 0.28) / 0.66)));
        const round = Math.max(0, (u - 0.9) / 0.1);
        return {
            top: 0.14 * round * round,
            bottom: 1 - 0.56 * sweep - 0.16 * round * round
        };
    }

    paintBackground() {
        const { width, height } = this.canvas;
        const canvas = makeCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const { left, right, top, bottom } = this.frame;
        const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
        rect(0, 0, width, height, '#16121f');

        // The case, then everything inside it, one column at a time
        const span = right - left;
        const across = bottom - top;
        const edge = u => {
            const line = this.outline(u);
            return { y0: Math.round(top + line.top * across), y1: Math.round(top + line.bottom * across) };
        };
        for (let x = left - 5; x <= right + 5; x++) {
            const { y0, y1 } = edge(Math.max(0, Math.min(1, (x - left) / span)));
            rect(x, y0 - 5, 1, y1 - y0 + 10, '#0a0810');
        }
        for (let x = left; x <= right; x++) {
            const u = (x - left) / span;
            const { y0, y1 } = edge(u);
            // Spruce soundboard, the color everything else sits on
            rect(x, y0, 1, y1 - y0, x % 9 === 0 ? '#a87840' : '#b98346');
            this.paintColumn(ctx, x, u, y0, y1, top, across, rect);
        }
        this.paintKeyboard(ctx, rect);
        this.paintCrack(ctx, rect);
        this.dimUnmended(ctx, edge);
        this.paintRoadSign(ctx);

        // Names along the top, for each part of the piano
        const label = (u, text, color) => Sprites.text(ctx, text, this.spotX(u), top - 14, { align: 'center', color });
        label(0.055, 'Keys', THEMES.ivory.floor[0]);
        label(0.3, 'Strings', THEMES.strings.accent);
        label(0.6, 'Dampers', THEMES.felt.accent);
        label(0.88, 'Board', THEMES.soundboard.accent);
        return canvas;
    }

    /**
     * Everything in one column of the piano, by how far along it is
     */
    paintColumn(ctx, x, u, y0, y1, top, across, rect) {
        const hammerLine = u > 0.115 && u < 0.14;
        const pinBlock = u >= 0.14 && u < 0.17;

        if (hammerLine) {
            rect(x, y0, 1, y1 - y0, '#3a2a1e');
            for (let y = y0 + 1; y < y1; y += 4) rect(x, y, 1, 2, '#e8d8c0');
            return;
        }
        if (pinBlock) {
            rect(x, y0, 1, y1 - y0, '#7a4a2a');
            if (x % 4 === 0) for (let y = y0 + 2; y < y1; y += 4) rect(x, y, 2, 2, '#dfe3ee');
            return;
        }
        if (u >= 0.17 && u < 0.97) {
            // Strings, copper in the bass and steel above it, ending on the bridge
            for (let y = y0 + 2; y < y1 - 1; y += 3) {
                const v = (y - top) / across;
                const bridge = 0.9 - v * 0.34;
                if (u < bridge) rect(x, y, 1, 1, v < 0.42 ? '#d8944a' : '#b5bccb');
                else if (u - bridge < 0.012) rect(x, y, 2, 3, '#5e3a1e');
            }
        }
        if (u > 0.47 && u < 0.52) {
            // A rank of dampers lying across the strings
            for (let y = y0 + 1; y < y1 - 1; y += 6) rect(x, y, 1, 4, '#7a2c48');
        }
    }

    /**
     * The white and black keys, turned on their side, with the bass at the top
     */
    paintKeyboard(ctx, rect) {
        const left = this.frame.left;
        const width = this.spotX(0.11) - left;
        const top = this.frame.top;
        const bottom = this.frame.bottom;
        const keySize = 5;
        const whites = Math.floor((bottom - top) / keySize);
        for (let i = 0; i < whites; i++) {
            const y = top + i * keySize;
            rect(left, y, width, keySize - 1, '#f2e8d2');
            rect(left, y + keySize - 1, width, 1, '#9a8e78');
            // Twos and threes, as on any piano
            if ([0, 1, 3, 4, 5].includes(i % 7) && i < whites - 1) {
                rect(left + Math.round(width * 0.42), y + keySize - 2, Math.round(width * 0.58), 3, '#15121f');
            }
        }
        // The one key nobody counted, shut away past the top of the keyboard
        const done = CampaignSave.get().finished;
        rect(left, bottom - 1, width, 5, done ? '#ffd45e' : '#2a2438');
        rect(left + width - 3, bottom - 1, 3, 5, done ? '#fff2b0' : '#ec8cf8');
    }

    /**
     * The split in the soundboard, running back toward the keys
     */
    paintCrack(ctx, rect) {
        const random = MapArt.seeded(4242);
        let y = this.spotY(0.42);
        for (let x = this.spotX(0.92); x > this.spotX(0.14); x -= 2) {
            y += Math.round((random() - 0.45) * 3);
            const u = (x - this.frame.left) / (this.frame.right - this.frame.left);
            const lowest = this.spotY(this.outline(u).bottom) - 4;
            y = Math.min(lowest, Math.max(this.spotY(0.4), y));
            rect(x, y, 2, 2, '#6d3a88');
            if (random() < 0.3) rect(x, y - 1, 1, 1, '#d868f0');
        }
    }

    /**
     * What has not been mended yet stays in the dark
     */
    dimUnmended(ctx, edge) {
        const { left, right } = this.frame;
        const span = right - left;
        ctx.fillStyle = 'rgba(16, 12, 26, 0.62)';
        MAP_REGIONS.forEach(region => {
            if (CampaignSave.isComplete(region.boss)) return;
            for (let x = Math.ceil(left + region.start * span); x < left + region.end * span && x <= right; x++) {
                const { y0, y1 } = edge((x - left) / span);
                ctx.fillRect(x, y0, 1, y1 - y0);
            }
        });
    }

    /**
     * The links of the road, lit as they are repaired
     */
    paintRoadSign(ctx) {
        const { width } = this.canvas;
        const gap = 14;
        const widths = ROAD_LINKS.map(link => Sprites.textWidth(link));
        let x = Math.round((width - widths.reduce((sum, w) => sum + w + gap, -gap)) / 2);
        ROAD_LINKS.forEach((link, i) => {
            const repairedBy = ROAD_REPAIRED_BY[link];
            const open = !repairedBy || CampaignSave.isComplete(repairedBy);
            Sprites.text(ctx, link, x, -1, { color: open ? '#ffd45e' : '#5a5670' });
            x += widths[i];
            if (i < ROAD_LINKS.length - 1) {
                ctx.fillStyle = open ? '#ffd45e' : '#3d3550';
                ctx.fillRect(x + 3, 6, gap - 6, 1);
            }
            x += gap;
        });
    }

    select(index, instant = false) {
        const level = this.levels[index];
        if (!level) return;
        const changed = index !== this.selected;
        this.selected = index;
        const node = this.nodeFor(level);
        if (instant || !this.pip) {
            this.pip = { x: node.x, y: node.y };
        }
        if (changed && !instant) window.audioSystem.select();
        this.onSelect(level, CampaignSave.isOpen(level));
    }

    /**
     * Step along the path, skipping stages that are not open yet
     */
    move(step) {
        let index = this.selected + step;
        while (index >= 0 && index < this.levels.length) {
            if (CampaignSave.isOpen(this.levels[index])) {
                this.select(index);
                return;
            }
            index += step;
        }
        window.audioSystem.denied();
    }

    /**
     * Pick the stage under a click
     * @returns {boolean} True if a stage was chosen
     */
    clickAt(clientX, clientY) {
        const box = this.canvas.getBoundingClientRect();
        const x = (clientX - box.left) / this.scale;
        const y = (clientY - box.top) / this.scale;
        let found = -1;
        let best = 15;
        this.levels.forEach((level, i) => {
            const node = this.nodeFor(level);
            const distance = Math.hypot(node.x - x, node.y - y);
            if (distance < best) {
                best = distance;
                found = i;
            }
        });
        if (found >= 0) this.select(found);
        return found >= 0;
    }

    loop(now) {
        if (!this.running) return;
        this.time = now;
        this.draw();
        requestAnimationFrame(time => this.loop(time));
    }

    draw() {
        const { ctx } = this;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.background, 0, 0);

        this.drawPaths(ctx);
        this.levels.forEach((level, i) => this.drawNode(ctx, level, i === this.selected));

        const target = this.nodeFor(this.levels[this.selected]);
        this.pip.x += (target.x - this.pip.x) * 0.1;
        this.pip.y += (target.y - this.pip.y) * 0.1;
        const walking = Math.hypot(target.x - this.pip.x, target.y - this.pip.y) > 1;
        const bob = walking ? Math.floor(this.time / 90) % 2 : Math.floor(this.time / 500) % 2;
        const pip = Sprites.tankPreview('blue');
        ctx.drawImage(pip, Math.round(this.pip.x) - 14, Math.round(this.pip.y) - 26 - bob);
    }

    drawPaths(ctx) {
        const main = this.levels.filter(level => !level.optional);
        for (let i = 1; i < main.length; i++) {
            const from = this.nodeFor(main[i - 1]);
            const to = this.nodeFor(main[i]);
            this.drawPath(ctx, from, to, CampaignSave.isComplete(main[i - 1].id));
        }
        this.levels.filter(level => level.optional).forEach(level => {
            this.drawPath(ctx, this.nodeFor(this.levels.find(other => other.id === level.after)), this.nodeFor(level), CampaignSave.isOpen(level));
        });
    }

    drawPath(ctx, from, to, open) {
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const steps = Math.floor(distance / 7);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const x = Math.round(from.x + (to.x - from.x) * t);
            const y = Math.round(from.y + (to.y - from.y) * t);
            ctx.fillStyle = OUTLINE_COLOR;
            ctx.fillRect(x - 2, y - 2, 5, 5);
            ctx.fillStyle = open ? '#ffd45e' : '#6d6488';
            ctx.fillRect(x - 1, y - 1, 3, 3);
        }
    }

    drawNode(ctx, level, selected) {
        const node = this.nodeFor(level);
        const open = CampaignSave.isOpen(level);
        const done = CampaignSave.isComplete(level.id);
        const size = level.boss ? 10 : 8;
        const pulse = selected && Math.floor(this.time / 300) % 2 ? 1 : 0;
        const face = done ? '#ffd45e' : (open ? '#f2e8d2' : '#5a5670');

        ctx.fillStyle = OUTLINE_COLOR;
        ctx.fillRect(node.x - size - 2 - pulse, node.y - size - 2 - pulse, (size + 2 + pulse) * 2, (size + 2 + pulse) * 2);
        if (selected) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(node.x - size - pulse - 1, node.y - size - pulse - 1, (size + pulse + 1) * 2, (size + pulse + 1) * 2);
        }
        ctx.fillStyle = face;
        ctx.fillRect(node.x - size, node.y - size, size * 2, size * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(node.x - size, node.y + size - 3, size * 2, 3);

        const icon = !open ? 'lock' : (level.boss ? 'crown' : (level.optional ? 'star' : (done ? 'note' : null)));
        if (icon) {
            const art = Sprites.icon(icon);
            ctx.drawImage(art, node.x - Math.ceil(art.width / 2), node.y - Math.ceil(art.height / 2));
        } else {
            Sprites.text(ctx, level.id.split('-')[1], node.x, node.y - 7, { align: 'center', color: OUTLINE_COLOR });
        }
    }
}

window.WorldMap = WorldMap;
