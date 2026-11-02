// =============================================================================
// TILE MAPS
// =============================================================================
// Every stage is a grid of tiles. This covers collision, line of fire, route
// finding, the art for each theme, and the arena generator for FFA and TDM.

const TILES = {
    FLOOR: 0, WALL: 1, PILLAR: 2, CRATE: 3, PIT: 4, SPIKES: 5,
    BOOST_N: 6, BOOST_E: 7, BOOST_S: 8, BOOST_W: 9,
    DOOR: 10, STRING: 11, GOAL: 12, KEYPAD: 13
};

// Characters used by the hand-drawn campaign maps
const TILE_LEGEND = {
    '.': TILES.FLOOR, ' ': TILES.FLOOR, '#': TILES.WALL, 'O': TILES.PILLAR,
    'x': TILES.CRATE, '_': TILES.PIT, '^': TILES.SPIKES,
    'A': TILES.BOOST_N, '>': TILES.BOOST_E, 'V': TILES.BOOST_S, '<': TILES.BOOST_W,
    'D': TILES.DOOR, '|': TILES.STRING, '-': TILES.STRING, 'G': TILES.GOAL, 'k': TILES.KEYPAD
};

const BOOST_DIRECTIONS = {
    [TILES.BOOST_N]: [0, -1], [TILES.BOOST_E]: [1, 0],
    [TILES.BOOST_S]: [0, 1], [TILES.BOOST_W]: [-1, 0]
};

const CRATE_HEALTH = 4;

const THEMES = {
    ivory: {
        name: 'Ivory Steppes', backdrop: '#1b1830', lit: true, style: 'keys',
        floor: ['#ece2cb', '#e0d4ba', '#c9bb9d'], wall: ['#2a2438', '#3f3754', '#15121f'],
        pit: '#120f1c', accent: '#f2c14e'
    },
    strings: {
        name: 'String Forest', backdrop: '#160f12', lit: true, style: 'copper',
        floor: ['#4f3328', '#5c3c2f', '#3f2820'], wall: ['#8a5a30', '#b9854a', '#55341e'],
        pit: '#0d0809', accent: '#f2a24e'
    },
    felt: {
        name: 'Felt Hollows', backdrop: '#0f0b18', lit: false, style: 'felt',
        floor: ['#3b2b55', '#463362', '#2f2245'], wall: ['#7a2c48', '#a84466', '#4d1a30'],
        pit: '#090611', accent: '#e06a8a'
    },
    soundboard: {
        name: 'The Soundboard', backdrop: '#120a16', lit: true, style: 'planks',
        floor: ['#b98346', '#c79254', '#9f6e39'], wall: ['#4a2460', '#6d3a88', '#2d1540'],
        pit: '#14081c', accent: '#d868f0'
    },
    // Under the keys, where only the crew has ever been
    keybed: {
        name: 'The Keybed', backdrop: '#120d0a', lit: true, style: 'planks',
        floor: ['#7a5633', '#8a6540', '#5e4128'], wall: ['#3a2a1e', '#5e4632', '#221810'],
        pit: '#0b0806', accent: '#d8a468', wallStyle: 'timber'
    },
    // The keys again, after dark, with the crack running up through them
    lastkey: {
        name: 'Past the Top C', backdrop: '#100c1a', lit: true, style: 'keys',
        floor: ['#5a5470', '#6b6484', '#433d58'], wall: ['#17131f', '#2c2638', '#0c0a12'],
        pit: '#090611', accent: '#ec8cf8'
    }
};

// The themes a Free For All or Team Battle can be played on
const ARENA_THEMES = ['ivory', 'strings', 'felt', 'soundboard'];

class TileMap {
    constructor(cols, rows, themeKey) {
        this.cols = cols;
        this.rows = rows;
        this.themeKey = themeKey;
        this.theme = THEMES[themeKey] || THEMES.ivory;
        this.tiles = new Uint8Array(cols * rows);
        this.health = new Uint8Array(cols * rows);
        this.vertical = new Uint8Array(cols * rows); // Strings: 1 when running north-south
        this.version = 0;      // Bumped when the layout changes, which expires routes
        this.fields = new Map();
        this.layer = null;     // Baked art for the static tiles
        this.width = cols * WORLD.TILE;
        this.height = rows * WORLD.TILE;
    }

    /**
     * Build a map from rows of legend characters. Anything else is left for the
     * caller as a list of marks, which is how enemies and items are placed.
     * @returns {{map: TileMap, marks: Array}} The map and its marks
     */
    static parse(rows, themeKey) {
        const cols = Math.max(...rows.map(row => row.length));
        const map = new TileMap(cols, rows.length, themeKey);
        const marks = [];
        rows.forEach((row, r) => {
            for (let c = 0; c < cols; c++) {
                const char = c < row.length ? row[c] : '#';
                if (char in TILE_LEGEND) {
                    map.set(c, r, TILE_LEGEND[char]);
                    if (char === '|') map.vertical[r * cols + c] = 1;
                } else {
                    marks.push({ char, c, r, x: (c + 0.5) * WORLD.TILE, y: (r + 0.5) * WORLD.TILE });
                }
            }
        });
        return { map, marks };
    }

    index(c, r) {
        return r * this.cols + c;
    }

    inBounds(c, r) {
        return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
    }

    at(c, r) {
        return this.inBounds(c, r) ? this.tiles[this.index(c, r)] : TILES.WALL;
    }

    set(c, r, type) {
        const i = this.index(c, r);
        this.tiles[i] = type;
        this.health[i] = type === TILES.CRATE ? CRATE_HEALTH : 0;
    }

    tileAt(x, y) {
        return this.at(Math.floor(x / WORLD.TILE), Math.floor(y / WORLD.TILE));
    }

    /**
     * Change a tile in play, expiring any routes that crossed it
     */
    change(c, r, type) {
        this.set(c, r, type);
        this.version++;
        this.fields.clear();
    }

    blocksTank(type, hovering) {
        if (type === TILES.PIT) return !hovering;
        return type === TILES.WALL || type === TILES.PILLAR || type === TILES.CRATE || type === TILES.DOOR;
    }

    blocksBullet(type) {
        return type === TILES.WALL || type === TILES.PILLAR || type === TILES.CRATE || type === TILES.DOOR;
    }

    /**
     * Would a tank of this size overlap anything solid at this position?
     * @param {boolean} hovering - True while dashing, which clears pits
     */
    tankBlocked(x, y, size, hovering = false) {
        const half = size / 2;
        const left = Math.floor((x - half) / WORLD.TILE);
        const right = Math.floor((x + half - 0.01) / WORLD.TILE);
        const top = Math.floor((y - half) / WORLD.TILE);
        const bottom = Math.floor((y + half - 0.01) / WORLD.TILE);
        for (let r = top; r <= bottom; r++) {
            for (let c = left; c <= right; c++) {
                if (this.blocksTank(this.at(c, r), hovering)) return true;
            }
        }
        return false;
    }

    /**
     * Is there a clear shot between two points?
     */
    lineClear(ax, ay, bx, by) {
        const distance = Math.hypot(bx - ax, by - ay);
        const steps = Math.ceil(distance / 14);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            if (this.blocksBullet(this.tileAt(ax + (bx - ax) * t, ay + (by - ay) * t))) return false;
        }
        return true;
    }

    // -------------------------------------------------------------------------
    // Route finding
    // -------------------------------------------------------------------------

    /**
     * Distance from every tile to the nearest goal, shared by anyone heading there.
     * Crates are passable at a high cost so that tanks will shoot through them.
     * @param {Array<{x:number,y:number}>} goals - World positions
     * @returns {Float64Array} Cost to reach a goal from each tile
     */
    field(goals) {
        const key = goals
            .map(goal => this.index(Math.floor(goal.x / WORLD.TILE), Math.floor(goal.y / WORLD.TILE)))
            .sort((a, b) => a - b)
            .join(',');
        const cached = this.fields.get(key);
        if (cached) return cached;

        // Costs compare exactly against the queue, so these must be full doubles
        const costs = new Float64Array(this.tiles.length).fill(Infinity);
        const heap = new MinHeap();
        goals.forEach(goal => {
            const c = Math.floor(goal.x / WORLD.TILE);
            const r = Math.floor(goal.y / WORLD.TILE);
            if (!this.inBounds(c, r)) return;
            costs[this.index(c, r)] = 0;
            heap.push(0, this.index(c, r));
        });

        while (heap.size > 0) {
            const { priority, value } = heap.pop();
            if (priority > costs[value]) continue;
            const c = value % this.cols;
            const r = Math.floor(value / this.cols);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const nc = c + dx;
                    const nr = r + dy;
                    const step = this.stepCost(nc, nr);
                    if (step === Infinity) continue;
                    if (dx && dy && !this.canCutCorner(c, r, dx, dy)) continue;
                    const next = priority + step * (dx && dy ? 1.42 : 1);
                    const i = this.index(nc, nr);
                    if (next < costs[i]) {
                        costs[i] = next;
                        heap.push(next, i);
                    }
                }
            }
        }

        if (this.fields.size > 24) this.fields.delete(this.fields.keys().next().value);
        this.fields.set(key, costs);
        return costs;
    }

    stepCost(c, r) {
        const type = this.at(c, r);
        if (type === TILES.WALL || type === TILES.PILLAR || type === TILES.PIT || type === TILES.DOOR) return Infinity;
        if (type === TILES.CRATE) return 7;
        if (type === TILES.SPIKES) return 16;
        if (type === TILES.STRING) return 10;
        // Tanks are nearly a tile wide, so a route that hugs a wall snags on it
        return this.besideSolid(c, r) ? 1.3 : 1;
    }

    besideSolid(c, r) {
        return this.blocksTank(this.at(c + 1, r)) || this.blocksTank(this.at(c - 1, r))
            || this.blocksTank(this.at(c, r + 1)) || this.blocksTank(this.at(c, r - 1));
    }

    /**
     * A diagonal step needs both tiles beside it clear, or the tank clips the corner
     */
    canCutCorner(c, r, dx, dy) {
        return !this.blocksTank(this.at(c + dx, r)) && !this.blocksTank(this.at(c, r + dy));
    }

    /**
     * Where to head next to follow a field downhill
     * @returns {{x:number,y:number,crate:boolean}|null} The next tile's center
     */
    nextStep(x, y, field) {
        const best = this.downhill(Math.floor(x / WORLD.TILE), Math.floor(y / WORLD.TILE), field);
        if (!best) return null;
        return {
            x: (best.c + 0.5) * WORLD.TILE,
            y: (best.r + 0.5) * WORLD.TILE,
            crate: this.at(best.c, best.r) === TILES.CRATE
        };
    }

    /**
     * The next stretch of a route: the farthest point along it that a tank can
     * drive straight at. That takes a corner in one line rather than tile by tile.
     * A tank caught on a corner goes back to the middle of its tile first, since
     * the way on from there is always clear.
     * @param {number} size - Width of the tank
     * @returns {{x:number,y:number,crate:boolean}|null} Where to drive, or null with no route
     */
    routePoint(x, y, size, field, lookahead = 6) {
        const startC = Math.floor(x / WORLD.TILE);
        const startR = Math.floor(y / WORLD.TILE);
        const path = [];
        let c = startC;
        let r = startR;
        for (let i = 0; i < lookahead; i++) {
            const next = this.downhill(c, r, field);
            if (!next) break;
            path.push(next);
            c = next.c;
            r = next.r;
            // Anything that is not plain floor has to be dealt with up close
            if (this.stepCost(c, r) > 2) break;
        }
        if (path.length === 0) return null;

        const center = tile => ({ x: (tile.c + 0.5) * WORLD.TILE, y: (tile.r + 0.5) * WORLD.TILE });
        const first = path[0];
        if (this.at(first.c, first.r) === TILES.CRATE) return { ...center(first), crate: true };

        for (let i = path.length - 1; i >= 0; i--) {
            if (this.at(path[i].c, path[i].r) === TILES.CRATE) continue;
            const point = center(path[i]);
            if (this.driveClear(x, y, point.x, point.y, size)) {
                return { ...point, crate: false, hazard: this.stepCost(path[i].c, path[i].r) > 2 };
            }
        }

        const home = center({ c: startC, r: startR });
        if (Math.hypot(home.x - x, home.y - y) > 7) return { ...home, crate: false };
        return { ...center(first), crate: false, hazard: this.stepCost(first.c, first.r) > 2 };
    }

    /**
     * Would stopping here hurt?
     * @param {boolean} ringing - Whether strings count, as they only hurt while they ring
     */
    hazardAt(x, y, ringing) {
        const type = this.tileAt(x, y);
        return type === TILES.SPIKES || type === TILES.PIT || (ringing && type === TILES.STRING);
    }

    /**
     * Could a tank drive in a straight line between two points without touching
     * anything solid or crossing a hazard it could have gone around?
     */
    driveClear(ax, ay, bx, by, size) {
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 14);
        const from = this.index(Math.floor(ax / WORLD.TILE), Math.floor(ay / WORLD.TILE));
        const to = this.index(Math.floor(bx / WORLD.TILE), Math.floor(by / WORLD.TILE));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = ax + (bx - ax) * t;
            const py = ay + (by - ay) * t;
            if (this.tankBlocked(px, py, size + 4)) return false;
            const c = Math.floor(px / WORLD.TILE);
            const r = Math.floor(py / WORLD.TILE);
            const tile = this.index(c, r);
            if (tile !== from && tile !== to && this.stepCost(c, r) > 2) return false;
        }
        return true;
    }

    /**
     * The neighboring tile that is closest to the goal
     */
    downhill(c, r, field) {
        if (!this.inBounds(c, r)) return null;
        let best = null;
        let bestCost = field[this.index(c, r)];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                const nc = c + dx;
                const nr = r + dy;
                if (!this.inBounds(nc, nr)) continue;
                if (dx && dy && !this.canCutCorner(c, r, dx, dy)) continue;
                const cost = field[this.index(nc, nr)];
                if (cost < bestCost) {
                    bestCost = cost;
                    best = { c: nc, r: nr };
                }
            }
        }
        return best;
    }

    /**
     * Route distance from a position, in tiles. Infinity means there is no way there.
     */
    routeCost(x, y, field) {
        const c = Math.floor(x / WORLD.TILE);
        const r = Math.floor(y / WORLD.TILE);
        return this.inBounds(c, r) ? field[this.index(c, r)] : Infinity;
    }

    /**
     * Find an open floor position, for spawns and pickups
     */
    randomOpenPoint(margin = 2) {
        for (let attempt = 0; attempt < 80; attempt++) {
            const c = randomInt(margin, this.cols - 1 - margin);
            const r = randomInt(margin, this.rows - 1 - margin);
            if (this.at(c, r) === TILES.FLOOR) {
                return { x: (c + 0.5) * WORLD.TILE, y: (r + 0.5) * WORLD.TILE };
            }
        }
        return null;
    }

    /**
     * Clear a block of tiles to floor, leaving the outer wall alone
     */
    clearAround(c, r, radius) {
        for (let y = r - radius; y <= r + radius; y++) {
            for (let x = c - radius; x <= c + radius; x++) {
                if (x > 0 && y > 0 && x < this.cols - 1 && y < this.rows - 1) this.set(x, y, TILES.FLOOR);
            }
        }
    }

    /**
     * Can every open tile be reached from this one?
     */
    allConnected(c, r) {
        const field = this.field([{ x: (c + 0.5) * WORLD.TILE, y: (r + 0.5) * WORLD.TILE }]);
        for (let i = 0; i < this.tiles.length; i++) {
            if (this.stepCost(i % this.cols, Math.floor(i / this.cols)) !== Infinity && field[i] === Infinity) return false;
        }
        return true;
    }
}

class MinHeap {
    constructor() {
        this.items = [];
    }

    get size() {
        return this.items.length;
    }

    push(priority, value) {
        const items = this.items;
        items.push({ priority, value });
        let i = items.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (items[parent].priority <= items[i].priority) break;
            [items[parent], items[i]] = [items[i], items[parent]];
            i = parent;
        }
    }

    pop() {
        const items = this.items;
        const top = items[0];
        const last = items.pop();
        if (items.length) {
            items[0] = last;
            let i = 0;
            for (;;) {
                const left = i * 2 + 1;
                const right = left + 1;
                let smallest = i;
                if (left < items.length && items[left].priority < items[smallest].priority) smallest = left;
                if (right < items.length && items[right].priority < items[smallest].priority) smallest = right;
                if (smallest === i) break;
                [items[smallest], items[i]] = [items[i], items[smallest]];
                i = smallest;
            }
        }
        return top;
    }
}

// =============================================================================
// ARENA GENERATOR
// =============================================================================
// Arenas are drawn in one quarter and mirrored, so that every spawn gets the same
// map. Layouts are picked at random so no two matches play alike.
const ArenaGenerator = {
    layouts: ['islands', 'crossroads', 'courtyard', 'colonnade', 'lanes', 'keyboard'],

    generate(viewCols, viewRows, themeKey = null) {
        const cols = Math.max(GAME_CONFIG.ARENA_MIN_COLS, Math.min(38, viewCols));
        const rows = Math.max(GAME_CONFIG.ARENA_MIN_ROWS, Math.min(22, viewRows));
        const theme = themeKey || ARENA_THEMES[randomInt(0, ARENA_THEMES.length - 1)];

        for (let attempt = 0; attempt < 12; attempt++) {
            const map = new TileMap(cols, rows, theme);
            this.border(map);
            this[this.layouts[randomInt(0, this.layouts.length - 1)]](map);
            this.scatter(map);
            this.themed(map);
            if (map.allConnected(2, 2)) return map;
        }
        const fallback = new TileMap(cols, rows, theme);
        this.border(fallback);
        return fallback;
    },

    border(map) {
        for (let c = 0; c < map.cols; c++) {
            map.set(c, 0, TILES.WALL);
            map.set(c, map.rows - 1, TILES.WALL);
        }
        for (let r = 0; r < map.rows; r++) {
            map.set(0, r, TILES.WALL);
            map.set(map.cols - 1, r, TILES.WALL);
        }
    },

    /**
     * Place a tile in all four mirrored positions
     */
    mirror(map, c, r, type) {
        const positions = [
            [c, r], [map.cols - 1 - c, r],
            [c, map.rows - 1 - r], [map.cols - 1 - c, map.rows - 1 - r]
        ];
        positions.forEach(([x, y]) => {
            if (x > 0 && y > 0 && x < map.cols - 1 && y < map.rows - 1) map.set(x, y, type);
        });
    },

    block(map, c, r, w, h, type) {
        for (let y = r; y < r + h; y++) {
            for (let x = c; x < c + w; x++) this.mirror(map, x, y, type);
        }
    },

    islands(map) {
        const count = randomInt(3, 5);
        for (let i = 0; i < count; i++) {
            const horizontal = Math.random() < 0.5;
            const c = randomInt(3, Math.floor(map.cols / 2) - 3);
            const r = randomInt(3, Math.floor(map.rows / 2) - 2);
            this.block(map, c, r, horizontal ? randomInt(2, 4) : 1, horizontal ? 1 : randomInt(2, 3), TILES.WALL);
        }
    },

    crossroads(map) {
        const midC = Math.floor(map.cols / 2);
        const midR = Math.floor(map.rows / 2);
        this.block(map, midC - 7, midR - 1, 5, 1, TILES.WALL);
        this.block(map, midC - 1, midR - 5, 1, 3, TILES.WALL);
        this.block(map, 4, 3, 3, 1, TILES.WALL);
        this.block(map, 4, 3, 1, 2, TILES.WALL);
    },

    courtyard(map) {
        const left = Math.floor(map.cols / 2) - 6;
        const top = Math.floor(map.rows / 2) - 4;
        this.block(map, left, top, 4, 1, TILES.WALL);
        this.block(map, left, top, 1, 2, TILES.WALL);
        this.block(map, 3, top + 2, 2, 1, TILES.PILLAR);
        this.block(map, Math.floor(map.cols / 2) - 1, Math.floor(map.rows / 2) - 1, 1, 1, TILES.PIT);
    },

    colonnade(map) {
        for (let r = 3; r < map.rows / 2; r += 3) {
            for (let c = 4; c < map.cols / 2; c += 4) {
                this.mirror(map, c, r, TILES.PILLAR);
            }
        }
    },

    lanes(map) {
        const quarter = Math.floor(map.rows / 4);
        this.block(map, 4, quarter, Math.floor(map.cols / 2) - 7, 1, TILES.WALL);
        this.block(map, Math.floor(map.cols / 2) - 2, Math.floor(map.rows / 2) - 2, 1, 2, TILES.PIT);
        this.block(map, 6, 2, 1, 1, TILES.PILLAR);
    },

    // Black keys standing in the white, the most piano of the layouts
    keyboard(map) {
        const pattern = [0, 1, 3, 4, 5];
        const top = 2;
        const height = Math.floor(map.rows / 2) - 3;
        pattern.forEach(step => {
            const c = 3 + step * 2;
            if (c < map.cols / 2 - 1) this.block(map, c, top, 1, height, TILES.WALL);
        });
    },

    scatter(map) {
        const quadrantTiles = (map.cols * map.rows) / 4;
        const crates = Math.floor(quadrantTiles * GAME_CONFIG.ARENA_CRATE_DENSITY);
        for (let i = 0; i < crates; i++) {
            const c = randomInt(2, Math.floor(map.cols / 2));
            const r = randomInt(2, Math.floor(map.rows / 2));
            if (map.at(c, r) === TILES.FLOOR) this.mirror(map, c, r, TILES.CRATE);
        }
        if (Math.random() < 0.7) {
            // Glissando strips along the edges
            const r = randomInt(2, 3);
            const c = randomInt(4, Math.floor(map.cols / 2) - 4);
            for (let i = 0; i < 3; i++) {
                if (map.at(c + i, r) === TILES.FLOOR) {
                    map.set(c + i, r, TILES.BOOST_E);
                    map.set(map.cols - 1 - c - i, map.rows - 1 - r, TILES.BOOST_W);
                }
            }
        }
    },

    // Each theme brings its own hazard to the arena
    themed(map) {
        const midC = Math.floor(map.cols / 2);
        const midR = Math.floor(map.rows / 2);
        if (map.themeKey === 'strings') {
            const r = randomInt(3, midR - 2);
            for (let c = 2; c < map.cols - 2; c++) {
                [r, map.rows - 1 - r].forEach(y => {
                    if (map.at(c, y) === TILES.FLOOR && c % 7 > 1) map.set(c, y, TILES.STRING);
                });
            }
        } else if (map.themeKey === 'soundboard') {
            for (let i = 0; i < 4; i++) {
                const c = randomInt(4, midC - 2);
                const r = randomInt(3, midR - 1);
                if (map.at(c, r) === TILES.FLOOR) this.mirror(map, c, r, TILES.SPIKES);
            }
        } else if (map.themeKey === 'ivory') {
            for (let c = midC - 2; c <= midC + 2; c++) {
                if (map.at(c, midR) === TILES.FLOOR) map.set(c, midR, TILES.KEYPAD);
            }
        }
    }
};

/**
 * Spawn points spaced around the edge of a map, nearest the walls first
 */
function arenaSpawnPoints(map, count) {
    const inset = 2;
    const left = inset;
    const right = map.cols - 1 - inset;
    const top = inset;
    const bottom = map.rows - 1 - inset;
    const perimeter = [];
    for (let c = left; c <= right; c++) perimeter.push([c, top]);
    for (let r = top + 1; r <= bottom; r++) perimeter.push([right, r]);
    for (let c = right - 1; c >= left; c--) perimeter.push([c, bottom]);
    for (let r = bottom - 1; r > top; r--) perimeter.push([left, r]);

    const points = [];
    const step = perimeter.length / Math.max(1, count);
    for (let i = 0; i < count; i++) {
        const [c, r] = perimeter[Math.floor(i * step)];
        map.clearAround(c, r, 1);
        points.push({ x: (c + 0.5) * WORLD.TILE, y: (r + 0.5) * WORLD.TILE });
    }
    map.fields.clear();
    return points;
}

// =============================================================================
// MAP ART
// =============================================================================
const MapArt = {
    /**
     * Bake every tile that never changes into one big canvas
     */
    bake(map) {
        const size = WORLD.TILE_PX;
        const canvas = makeCanvas(map.cols * size, map.rows * size);
        const ctx = canvas.getContext('2d');
        const random = this.seeded(map.cols * 7919 + map.rows * 31);

        for (let r = 0; r < map.rows; r++) {
            for (let c = 0; c < map.cols; c++) {
                this.floor(ctx, map, c, r, c * size, r * size, random);
            }
        }

        // Anything painted or scratched onto the floor of a stage
        (map.decals || []).forEach(decal => {
            Sprites.text(ctx, decal.text, (decal.c + 0.5) * size, decal.r * size, {
                align: 'center', color: map.theme.floor[2]
            });
        });
        for (let r = 0; r < map.rows; r++) {
            for (let c = 0; c < map.cols; c++) {
                const type = map.at(c, r);
                const x = c * size;
                const y = r * size;
                if (type === TILES.WALL) this.wall(ctx, map, c, r, x, y, random);
                else if (type === TILES.PILLAR) this.pillar(ctx, map, x, y);
                else if (type === TILES.PIT) this.pit(ctx, map, c, r, x, y);
                else if (type === TILES.SPIKES) this.spikes(ctx, x, y, random);
            }
        }
        map.layer = canvas;
    },

    seeded(seed) {
        let state = seed;
        return () => {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
    },

    floor(ctx, map, c, r, x, y, random) {
        const size = WORLD.TILE_PX;
        const [base, light, dark] = map.theme.floor;
        const rect = (px, py, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(px, py, w, h); };
        rect(x, y, size, size, base);

        const style = map.theme.style;
        if (style === 'keys') {
            // Each white key is four tiles wide, with a seam between them
            if (c % 4 === 0) {
                rect(x, y, 1, size, dark);
                rect(x + 1, y, 1, size, light);
            }
            if (random() < 0.12) rect(x + 3 + random() * 10, y + 3 + random() * 10, 2, 1, light);
        } else if (style === 'copper') {
            // Copper strings running the length of the map
            if (r % 3 === 1) {
                rect(x, y + 7, size, 1, '#c8854a');
                rect(x, y + 8, size, 1, '#6a3e22');
            }
            if (random() < 0.25) rect(x + random() * 12, y + random() * 14, 3, 1, light);
            if (random() < 0.2) rect(x + random() * 12, y + random() * 14, 2, 1, dark);
        } else if (style === 'felt') {
            // Soft speckled felt
            for (let i = 0; i < 5; i++) {
                rect(x + random() * 15, y + random() * 15, 1, 1, random() < 0.5 ? light : dark);
            }
            if ((c + r) % 7 === 0) rect(x + 2, y + 15, 12, 1, dark);
        } else {
            // Spruce planks with grain and the odd knot
            rect(x, y, size, 1, dark);
            rect(x, y + 8, size, 1, dark);
            if (c % 4 === (r % 2) * 2) rect(x, y, 1, 8, dark);
            if (random() < 0.5) rect(x + random() * 10, y + 2 + random() * 4, 5, 1, light);
            if (random() < 0.5) rect(x + random() * 10, y + 10 + random() * 4, 5, 1, light);
            if (random() < 0.04) rect(x + 6, y + 4, 2, 2, dark);
        }
    },

    wall(ctx, map, c, r, x, y, random) {
        const size = WORLD.TILE_PX;
        const [base, light, dark] = map.theme.wall;
        const rect = (px, py, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(px, py, w, h); };
        const solid = (dx, dy) => map.at(c + dx, r + dy) === TILES.WALL;
        const lipBelow = !solid(0, 1);

        rect(x, y, size, size, base);

        const style = map.theme.wallStyle || map.theme.style;
        if (style === 'keys') {
            // Lacquered black key with a stripe of reflected light
            rect(x + 3, y, 2, size, light);
            if (!solid(-1, 0)) rect(x, y, 1, size, light);
        } else if (style === 'copper' || style === 'timber') {
            // Timber bracing with brass plates
            rect(x, y + 5, size, 1, dark);
            rect(x, y + 11, size, 1, dark);
            rect(x + (r % 2 ? 4 : 11), y, 1, 5, dark);
            if ((c + r) % 3 === 0) rect(x + 6, y + 7, 3, 3, light);
        } else if (style === 'felt') {
            // Stacked felt hammer heads
            rect(x, y + 1, size, 3, light);
            rect(x, y + 8, size, 2, light);
            if ((c + r) % 2) rect(x + 5, y + 4, 2, 4, dark);
        } else {
            // Dissonant crystal growing through the beams
            rect(x + 2, y + 2, 4, 4, light);
            rect(x + 9, y + 8, 5, 3, light);
            rect(x + 3, y + 3, 1, 1, '#ffffff');
            if (random() < 0.3) rect(x + 11, y + 3, 2, 2, map.theme.accent);
        }

        if (!solid(0, -1)) rect(x, y, size, 1, light);
        if (lipBelow) {
            rect(x, y + size - 4, size, 4, dark);
            rect(x, y + size, size, 2, 'rgba(0, 0, 0, 0.22)');
        }
    },

    // Tuning pins, the steel pegs that hold a piano's strings
    pillar(ctx, map, x, y) {
        const cx = x + 8;
        const cy = y + 8;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(x + 2, y + 12, 13, 3);
        Sprites.pixelCircle(ctx, cx, cy, 6, OUTLINE_COLOR);
        Sprites.pixelCircle(ctx, cx, cy, 5, '#6d7088');
        Sprites.pixelCircle(ctx, cx, cy - 1, 4, '#9ea3b8');
        Sprites.pixelCircle(ctx, cx - 1, cy - 2, 2, '#dfe3ee');
        ctx.fillStyle = OUTLINE_COLOR;
        ctx.fillRect(cx - 3, cy, 7, 1);
    },

    pit(ctx, map, c, r, x, y) {
        const size = WORLD.TILE_PX;
        ctx.fillStyle = map.theme.pit;
        ctx.fillRect(x, y, size, size);
        // The near edge of the drop catches some light
        if (map.at(c, r - 1) !== TILES.PIT) {
            ctx.fillStyle = map.theme.floor[2];
            ctx.fillRect(x, y, size, 3);
            ctx.fillStyle = OUTLINE_COLOR;
            ctx.fillRect(x, y + 3, size, 1);
        }
    },

    spikes(ctx, x, y, random) {
        for (let i = 0; i < 5; i++) {
            const px = x + 1 + Math.floor(random() * 12);
            const py = y + 2 + Math.floor(random() * 10);
            ctx.fillStyle = OUTLINE_COLOR;
            ctx.fillRect(px - 1, py - 3, 5, 7);
            ctx.fillStyle = '#a050c0';
            ctx.fillRect(px, py - 2, 3, 5);
            ctx.fillStyle = '#ec8cf8';
            ctx.fillRect(px, py - 2, 1, 3);
        }
    },

    crate(map, damage) {
        return Sprites.cached(`crate:${map.themeKey}:${damage}`, () => {
            const canvas = makeCanvas(16, 16);
            const ctx = canvas.getContext('2d');
            const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
            rect(1, 1, 14, 14, '#7a4a2a');
            rect(2, 2, 12, 12, '#b07a44');
            rect(2, 2, 12, 2, '#d8a468');
            rect(2, 12, 12, 2, '#7a4a2a');
            rect(1, 7, 14, 2, '#7a4a2a');
            rect(7, 1, 2, 14, '#7a4a2a');
            rect(6, 6, 4, 4, '#ffd45e');
            rect(7, 7, 2, 2, '#a8681a');
            if (damage > 0) {
                rect(3, 3, 1, 4, '#3a2214');
                rect(4, 6, 2, 1, '#3a2214');
            }
            if (damage > 1) {
                rect(11, 9, 1, 5, '#3a2214');
                rect(9, 12, 2, 1, '#3a2214');
                rect(10, 3, 1, 3, '#3a2214');
            }
            return Sprites.outlined(canvas);
        });
    }
};

window.TileMap = TileMap;
window.ArenaGenerator = ArenaGenerator;
window.MapArt = MapArt;
