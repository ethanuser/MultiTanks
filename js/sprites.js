// =============================================================================
// PIXEL ART SYSTEM
// =============================================================================
// Every piece of art in the game is drawn here, in code, onto small canvases that
// are cached and stamped into the low-resolution game canvas. Nothing is scaled at
// draw time, which is what keeps the pixels square.

const OUTLINE_COLOR = '#1b1830';

function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function hexToRgb(hex) {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const Sprites = {
    cache: new Map(),

    /**
     * Get or build a cached sprite
     * @param {string} key - Unique cache key
     * @param {Function} build - Called once to build the canvas
     */
    cached(key, build) {
        let sprite = this.cache.get(key);
        if (!sprite) {
            sprite = build();
            this.cache.set(key, sprite);
        }
        return sprite;
    },

    /**
     * Turn rows of characters into a canvas. A space or dot is transparent.
     * @param {Array<string>} rows - Pixel rows
     * @param {Object} colors - Map of character to color
     */
    fromRows(rows, colors) {
        const width = Math.max(...rows.map(row => row.length));
        const canvas = makeCanvas(width, rows.length);
        const ctx = canvas.getContext('2d');
        rows.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                const color = colors[row[x]];
                if (!color) continue;
                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
            }
        });
        return canvas;
    },

    /**
     * Add a one pixel outline around everything opaque in a canvas
     * @param {HTMLCanvasElement} source - Sprite to outline (needs a 1px margin)
     * @param {string} color - Outline color
     */
    outlined(source, color = OUTLINE_COLOR) {
        const { width, height } = source;
        const canvas = makeCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const pixels = source.getContext('2d').getImageData(0, 0, width, height).data;
        const solid = (x, y) => x >= 0 && y >= 0 && x < width && y < height && pixels[(y * width + x) * 4 + 3] > 0;
        ctx.fillStyle = color;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        ctx.drawImage(source, 0, 0);
        return canvas;
    },

    /**
     * Rotate a sprite by sampling the nearest source pixel, which keeps hard edges
     */
    rotated(source, angle) {
        const { width, height } = source;
        const canvas = makeCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const input = source.getContext('2d').getImageData(0, 0, width, height);
        const output = ctx.createImageData(width, height);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const cx = width / 2;
        const cy = height / 2;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x + 0.5 - cx;
                const dy = y + 0.5 - cy;
                const sx = Math.floor(cos * dx + sin * dy + cx);
                const sy = Math.floor(-sin * dx + cos * dy + cy);
                if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
                const from = (sy * width + sx) * 4;
                const to = (y * width + x) * 4;
                for (let i = 0; i < 4; i++) output.data[to + i] = input.data[from + i];
            }
        }
        ctx.putImageData(output, 0, 0);
        return canvas;
    },

    /**
     * Fill a circle made of whole pixels
     */
    pixelCircle(ctx, cx, cy, radius, color) {
        ctx.fillStyle = color;
        for (let y = -radius; y <= radius; y++) {
            const span = Math.floor(Math.sqrt(radius * radius - y * y) + 0.35);
            ctx.fillRect(cx - span, cy + y, span * 2 + 1, 1);
        }
    },

    // -------------------------------------------------------------------------
    // Tanks
    // -------------------------------------------------------------------------

    /**
     * A tank hull facing one of eight directions
     * @param {string} chassisKey - Key into CHASSIS
     * @param {string} paletteKey - Key into TANK_PALETTES
     * @param {number} direction - 0 to 7, in 45 degree steps from east
     * @param {number} frame - Tread animation frame, 0 or 1
     */
    hull(chassisKey, paletteKey, direction, frame) {
        const key = `hull:${chassisKey}:${paletteKey}:${direction}:${frame}`;
        return this.cached(key, () => {
            const chassis = CHASSIS[chassisKey];
            const diagonal = direction % 2 === 1;
            const base = this.paintHull(chassis, TANK_PALETTES[paletteKey], frame, diagonal);
            return this.outlined(this.rotated(base, direction * Math.PI / 4));
        });
    },

    paintHull(chassis, pal, frame, diagonal = false) {
        const { grid, length, width, tread } = chassis;
        const canvas = makeCanvas(grid, grid);
        const ctx = canvas.getContext('2d');
        const x0 = Math.round((grid - length) / 2);
        const y0 = Math.round((grid - width) / 2);
        const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };

        // Tracks run the full length and stick out past the body at both ends.
        // Fine links turn to noise at 45 degrees, so diagonals get wider ones.
        const treadDark = '#2b2840';
        const treadMid = '#454260';
        const treadLight = '#8a86a4';
        const linkStep = diagonal ? 4 : 2;
        [y0, y0 + width - tread].forEach(y => {
            rect(x0, y, length, tread, treadDark);
            rect(x0 + 1, y + (y === y0 ? 0 : tread - 1), length - 2, 1, treadMid);
            for (let x = x0 + 1 + (frame ? linkStep / 2 : 0); x < x0 + length - 1; x += linkStep) {
                rect(Math.floor(x), y, diagonal ? 2 : 1, tread, treadLight);
            }
            // Rounded ends
            ctx.clearRect(x0, y === y0 ? y : y + tread - 1, 1, 1);
            ctx.clearRect(x0 + length - 1, y === y0 ? y : y + tread - 1, 1, 1);
        });

        // The body sits between the tracks, a little shorter than they are
        const bx = x0 + 2;
        const by = y0 + tread;
        const bw = length - 4;
        const bh = width - tread * 2;
        rect(bx, by, bw, bh, pal.m);
        rect(bx, by, bw, 1, pal.l);
        rect(bx, by + bh - 1, bw, 1, pal.d);

        // Sloped front plate, and an engine deck with vents at the rear
        rect(bx + bw - 2, by, 2, bh, pal.l);
        rect(bx + bw - 1, by, 1, bh, pal.h);
        rect(bx, by, 3, bh, pal.d);
        for (let y = by + 1; y < by + bh - 1; y += 2) rect(bx, y, 2, 1, treadDark);

        // Fenders over the tracks
        rect(bx - 1, by - 1, bw + 2, 1, pal.d);
        rect(bx - 1, by + bh, bw + 2, 1, pal.d);

        // Chassis personality
        if (chassis.detail === 'plated') {
            rect(x0 + 1, y0 - 1, length - 2, 1, pal.m);
            rect(x0 + 1, y0 + width, length - 2, 1, pal.m);
            rect(x0 + 1, y0 - 1, 1, 1, pal.h);
            rect(x0 + length - 2, y0 + width, 1, 1, pal.h);
        } else if (chassis.detail === 'skirt') {
            for (let x = bx + 1; x < bx + bw; x += 4) {
                rect(x, by - 1, 2, 1, pal.m);
                rect(x, by + bh, 2, 1, pal.m);
            }
        } else if (chassis.detail === 'rivets') {
            for (let x = bx + 3; x < bx + bw - 2; x += 3) {
                rect(x, by, 1, 1, pal.h);
                rect(x, by + bh - 1, 1, 1, pal.h);
            }
        } else if (chassis.detail === 'blade') {
            rect(x0 + length, y0 + 1, 2, width - 2, pal.h);
            rect(x0 + length, y0 + 1, 1, width - 2, pal.d);
        }
        return canvas;
    },

    /**
     * The round turret a tank's face sits on
     */
    dome(chassisKey, paletteKey) {
        return this.cached(`dome:${chassisKey}:${paletteKey}`, () => {
            const radius = CHASSIS[chassisKey].dome;
            const size = radius * 2 + 3;
            const pal = TANK_PALETTES[paletteKey];
            const canvas = makeCanvas(size, size);
            const ctx = canvas.getContext('2d');
            const c = radius + 1;
            this.pixelCircle(ctx, c, c, radius, pal.d);
            this.pixelCircle(ctx, c, c - 1, radius - 1, pal.m);
            this.pixelCircle(ctx, c - 1, c - 2, Math.max(1, radius - 2), pal.l);
            ctx.fillStyle = pal.h;
            ctx.fillRect(c - radius + 2, c - radius + 1, 3, 1);
            ctx.fillRect(c - radius + 1, c - radius + 2, 1, 1);
            return this.outlined(canvas);
        });
    },

    // -------------------------------------------------------------------------
    // Text
    // -------------------------------------------------------------------------

    /**
     * A letter from the pixel font, cached by color. Unknown characters show as a
     * question mark rather than vanishing.
     * @param {string} char - One character
     * @param {number} scale - Whole number of art pixels to each font pixel
     * @param {string} color - Fill color
     */
    glyph(char, scale, color) {
        return this.cached(`glyph:${char}:${scale}:${color}`, () => {
            if (char === ' ') {
                const blank = makeCanvas(1, 1);
                blank.advance = (FONT_SPACE_WIDTH + 1) * scale;
                return blank;
            }
            const rows = (PIXEL_FONT[char] || PIXEL_FONT['?']).split('/');
            const width = rows[0].length;
            const canvas = makeCanvas(width * scale, (FONT_TOP_PAD + rows.length) * scale);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            rows.forEach((row, y) => {
                for (let x = 0; x < width; x++) {
                    if (row[x] === '#') ctx.fillRect(x * scale, (y + FONT_TOP_PAD) * scale, scale, scale);
                }
            });
            canvas.advance = (width + 1) * scale; // One clear pixel between letters
            return canvas;
        });
    },

    /**
     * Text sizes come in whole multiples of the font's pixels, which keeps it crisp
     */
    fontScale(size) {
        return Math.max(1, Math.round(size / 10));
    },

    textWidth(text, size = 10) {
        const scale = this.fontScale(size);
        let width = 0;
        for (const char of text) width += this.glyph(char, scale, '#ffffff').advance;
        return Math.max(0, width - scale);
    },

    /**
     * Draw a line of pixel text
     * @param {CanvasRenderingContext2D} ctx - Target
     * @param {string} text - Text to draw
     * @param {number} x - Anchor x
     * @param {number} y - Top of the line
     * @param {Object} options - color, size, align ('left', 'center', 'right') and shadow color
     */
    text(ctx, text, x, y, options = {}) {
        const { color = '#ffffff', size = 10, align = 'left', shadow = null } = options;
        const value = String(text);
        let cursor = Math.round(x);
        if (align === 'center') cursor -= Math.round(this.textWidth(value, size) / 2);
        if (align === 'right') cursor -= this.textWidth(value, size);
        const top = Math.round(y);
        if (shadow) {
            this.drawRun(ctx, value, cursor + 1, top + 1, size, shadow);
        }
        this.drawRun(ctx, value, cursor, top, size, color);
    },

    drawRun(ctx, text, x, y, size, color) {
        const scale = this.fontScale(size);
        let cursor = x;
        for (const char of text) {
            const glyph = this.glyph(char, scale, color);
            ctx.drawImage(glyph, cursor, y);
            cursor += glyph.advance;
        }
    },

    /**
     * Break text into lines that fit a width
     */
    wrapText(text, maxWidth, size = 10) {
        const lines = [];
        let line = '';
        text.split(' ').forEach(word => {
            const attempt = line ? `${line} ${word}` : word;
            if (this.textWidth(attempt, size) > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = attempt;
            }
        });
        if (line) lines.push(line);
        return lines;
    },

    // -------------------------------------------------------------------------
    // Icons
    // -------------------------------------------------------------------------

    icon(name) {
        return this.cached(`icon:${name}`, () => {
            const art = ICONS[name] || ICONS.star;
            return this.outlined(this.fromRows(art.rows, art.colors));
        });
    },

    /**
     * Bullet art, by kind
     */
    bullet(kind, color) {
        return this.cached(`bullet:${kind}:${color}`, () => {
            const art = BULLET_ART[kind] || BULLET_ART.shot;
            return this.outlined(this.fromRows(art, { '#': color, '+': '#ffffff' }));
        });
    },

    /**
     * Stylesheet rules for the plain icons. Each is drawn at six times its size,
     * which halves cleanly at 27 pixels on any screen.
     */
    iconStyles() {
        const scale = 6;
        return Object.entries(UI_ICONS).map(([name, rows]) => {
            const canvas = makeCanvas(rows[0].length * scale, rows.length * scale);
            const ctx = canvas.getContext('2d');
            rows.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) {
                    if (row[x] === '#') ctx.fillRect(x * scale, y * scale, scale, scale);
                }
            });
            const url = canvas.toDataURL();
            return `.ic-${name}{-webkit-mask-image:url(${url});mask-image:url(${url})}`;
        }).join('');
    },

    /**
     * Draw a sprite as a data URL, for the menus
     */
    toDataURL(canvas, scale = 3) {
        const big = makeCanvas(canvas.width * scale, canvas.height * scale);
        const ctx = big.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, big.width, big.height);
        return big.toDataURL();
    },

    /**
     * A finished tank at rest, as used in menus and portraits
     */
    tankPreview(paletteKey, chassisKey = 'player', eyes = 'cute') {
        return this.cached(`preview:${paletteKey}:${chassisKey}:${eyes}`, () => {
            const chassis = CHASSIS[chassisKey];
            const canvas = makeCanvas(chassis.grid + 8, chassis.grid);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.hull(chassisKey, paletteKey, 0, 0), 0, 0);
            const cx = chassis.grid / 2;
            const cy = chassis.grid / 2;
            drawTankBarrel(ctx, cx, cy, 0, chassis, TANK_PALETTES[paletteKey], chassis.barrel);
            const dome = this.dome(chassisKey, paletteKey);
            ctx.drawImage(dome, Math.round(cx - dome.width / 2), Math.round(cy - dome.height / 2));
            drawTankFace(ctx, cx, cy, 0, chassis, eyes, 0);
            return canvas;
        });
    }
};

// =============================================================================
// CHASSIS
// =============================================================================
// Hull art is painted facing east into a square grid of this many art pixels
const CHASSIS = {
    player: { grid: 28, length: 18, width: 15, tread: 3, dome: 5, barrel: 'single', barrelLength: 14, detail: 'skirt' },
    buddy: { grid: 20, length: 12, width: 11, tread: 2, dome: 4, barrel: 'single', barrelLength: 9, detail: 'none' },
    scout: { grid: 20, length: 13, width: 11, tread: 2, dome: 4, barrel: 'single', barrelLength: 9, detail: 'blade' },
    triplet: { grid: 26, length: 17, width: 15, tread: 3, dome: 5, barrel: 'triple', barrelLength: 11, detail: 'rivets' },
    heavy: { grid: 32, length: 22, width: 19, tread: 4, dome: 6, barrel: 'heavy', barrelLength: 14, detail: 'plated' },
    sniper: { grid: 26, length: 18, width: 13, tread: 3, dome: 4, barrel: 'long', barrelLength: 17, detail: 'skirt' },
    bomb: { grid: 24, length: 14, width: 14, tread: 3, dome: 6, barrel: 'none', barrelLength: 0, detail: 'rivets' },
    wisp: { grid: 24, length: 15, width: 13, tread: 3, dome: 5, barrel: 'single', barrelLength: 11, detail: 'none' },
    medic: { grid: 24, length: 16, width: 14, tread: 3, dome: 5, barrel: 'none', barrelLength: 0, detail: 'plated' },
    trill: { grid: 24, length: 16, width: 14, tread: 3, dome: 5, barrel: 'twin', barrelLength: 12, detail: 'rivets' },
    emplacement: { grid: 28, length: 18, width: 18, tread: 2, dome: 6, barrel: 'heavy', barrelLength: 13, detail: 'plated' },
    // Bosses
    bossThump: { grid: 46, length: 34, width: 30, tread: 6, dome: 9, barrel: 'heavy', barrelLength: 18, detail: 'plated' },
    bossTremolo: { grid: 40, length: 20, width: 18, tread: 3, dome: 8, barrel: 'triple', barrelLength: 12, detail: 'none' },
    bossMute: { grid: 50, length: 36, width: 34, tread: 7, dome: 10, barrel: 'none', barrelLength: 0, detail: 'plated' }
};

// Guns are the same steel on every tank, so they stand out against any hull
const GUN_METAL = { dark: '#5a5670', mid: '#9296b0', light: '#dfe3ee' };

/**
 * Draw a thick pixel line by stamping squares, so a barrel stays crisp at any angle
 */
function stampLine(ctx, x0, y0, angle, length, thickness, color) {
    ctx.fillStyle = color;
    const half = Math.floor(thickness / 2);
    for (let t = 0; t <= length; t++) {
        const x = Math.round(x0 + Math.cos(angle) * t) - half;
        const y = Math.round(y0 + Math.sin(angle) * t) - half;
        ctx.fillRect(x, y, thickness, thickness);
    }
}

/**
 * Draw a tank's gun or guns
 */
function drawTankBarrel(ctx, cx, cy, angle, chassis, pal, style, recoil = 0) {
    const length = chassis.barrelLength - recoil;
    if (style === 'none' || length <= 0) return;
    const perp = angle + Math.PI / 2;
    const lines = {
        single: [[0, 2]],
        long: [[0, 2]],
        heavy: [[0, 4]],
        twin: [[-2, 2], [2, 2]],
        triple: [[-3, 2], [0, 2], [3, 2]]
    }[style] || [[0, 2]];

    lines.forEach(([offset, width]) => {
        const x = cx + Math.cos(perp) * offset;
        const y = cy + Math.sin(perp) * offset;
        stampLine(ctx, x, y, angle, length, width + 2, OUTLINE_COLOR);
    });
    lines.forEach(([offset, width]) => {
        const x = cx + Math.cos(perp) * offset;
        const y = cy + Math.sin(perp) * offset;
        stampLine(ctx, x, y, angle, length, width, GUN_METAL.mid);
        stampLine(ctx, x, y, angle, length, Math.max(1, width - 2), GUN_METAL.light);
    });

    // A flared muzzle marks the end of the gun
    lines.forEach(([offset, width]) => {
        const reach = length - 1;
        const x = cx + Math.cos(perp) * offset + Math.cos(angle) * reach;
        const y = cy + Math.sin(perp) * offset + Math.sin(angle) * reach;
        const flare = width + 1;
        const half = Math.floor(flare / 2);
        ctx.fillStyle = OUTLINE_COLOR;
        ctx.fillRect(Math.round(x) - half - 1, Math.round(y) - half - 1, flare + 2, flare + 2);
        ctx.fillStyle = GUN_METAL.dark;
        ctx.fillRect(Math.round(x) - half, Math.round(y) - half, flare, flare);
    });
}

/**
 * Draw a tank's eyes. They follow the turret, which is what gives each tank its look.
 * @param {string} style - cute, angry, sleepy or hollow
 * @param {number} blink - 1 while the eyes are shut
 */
function drawTankFace(ctx, cx, cy, angle, chassis, style, blink) {
    const radius = chassis.dome;
    const forward = Math.max(1, radius - 3);
    const spread = radius >= 5 ? 2.6 : 2;
    const fx = cx + Math.cos(angle) * forward;
    const fy = cy + Math.sin(angle) * forward;
    const px = Math.cos(angle + Math.PI / 2) * spread;
    const py = Math.sin(angle + Math.PI / 2) * spread;
    const size = radius >= 5 ? 3 : 2;

    [[-1, px, py], [1, -px, -py]].forEach(([side, ox, oy]) => {
        const ex = Math.round(fx + ox - size / 2);
        const ey = Math.round(fy + oy - size / 2);
        if (blink || style === 'sleepy') {
            ctx.fillStyle = OUTLINE_COLOR;
            ctx.fillRect(ex, ey + size - 1, size, 1);
            return;
        }
        if (style === 'hollow') {
            ctx.fillStyle = OUTLINE_COLOR;
            ctx.fillRect(ex, ey, size, size);
            ctx.fillStyle = '#ff5a7a';
            ctx.fillRect(ex + (size > 2 ? 1 : 0), ey + (size > 2 ? 1 : 0), Math.max(1, size - 2), Math.max(1, size - 2));
            return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ex, ey, size, size);
        ctx.fillStyle = OUTLINE_COLOR;
        const pupil = Math.max(1, size - 1);
        ctx.fillRect(ex + Math.round(Math.cos(angle) * 0.6 + 0.4), ey + Math.round(Math.sin(angle) * 0.6 + 0.4), pupil, pupil);
        if (style === 'angry') {
            ctx.fillStyle = OUTLINE_COLOR;
            ctx.fillRect(ex - (side > 0 ? 0 : 1), ey - 1, size + 1, 1);
        }
    });
}

// =============================================================================
// ICONS
// =============================================================================
const ICON_INK = { '#': '#1b1830' };
const ICONS = {
    heart: {
        colors: { '#': '#ec4d6e', '+': '#ffb0b8' },
        rows: [
            '            ',
            '  ##   ##   ',
            ' #+##.####  ',
            ' #+#######  ',
            ' #########  ',
            '  #######   ',
            '   #####    ',
            '    ###     ',
            '     #      ',
            '            '
        ]
    },
    star: {
        colors: { '#': '#ffd45e', '+': '#fff2b0' },
        rows: [
            '            ',
            '     #      ',
            '     #      ',
            '    #+#     ',
            ' ##########  ',
            '  ##+####   ',
            '   ######   ',
            '   ##  ##   ',
            '  ##    ##  ',
            '            '
        ]
    },
    wing: {
        colors: { '#': '#6fe6cf', '+': '#ffffff' },
        rows: [
            '            ',
            '  ##   ##   ',
            '   ##   ##  ',
            '    ##   ## ',
            '     ##   ##',
            '    ##   ## ',
            '   ##   ##  ',
            '  ##   ##   ',
            '            '
        ]
    },
    notes: {
        colors: { '#': '#7cc0f5', '+': '#ffffff' },
        rows: [
            '            ',
            '    ######  ',
            '    ######  ',
            '    #    #  ',
            '    #    #  ',
            '    #    #  ',
            '  ###  ###  ',
            ' ####+####  ',
            ' ###  ###   ',
            '            '
        ]
    },
    triple: {
        colors: { '#': '#bb95f5', '+': '#ffffff' },
        rows: [
            '  #         ',
            '   #        ',
            '    #    #  ',
            '     #  #   ',
            ' #####+#    ',
            '     #  #   ',
            '    #    #  ',
            '   #        ',
            '  #         '
        ]
    },
    spring: {
        colors: { '#': '#ffb066', '+': '#ffe2bd' },
        rows: [
            '            ',
            '  ########  ',
            '     ##     ',
            '  ###+++##  ',
            '     ##     ',
            '  ##+++###  ',
            '     ##     ',
            '  ########  ',
            '            '
        ]
    },
    clef: {
        colors: { '#': '#ffd45e', '+': '#fff2b0' },
        rows: [
            '     ##     ',
            '    #  #    ',
            '    # #     ',
            '    ##      ',
            '   ##       ',
            '  ## ##     ',
            ' ##  # ##   ',
            ' #  ##  #   ',
            '  # ## #    ',
            '   ####     ',
            '     #      ',
            '   ###      '
        ]
    },
    shield: {
        colors: { '#': '#7cc0f5', '+': '#ffffff' },
        rows: [
            '            ',
            '  ########  ',
            '  #+++++##  ',
            '  #+######  ',
            '  #+######  ',
            '   #+####   ',
            '   ######   ',
            '    ####    ',
            '     ##     ',
            '            '
        ]
    },
    burst: {
        colors: { '#': '#ffb066', '+': '#fff2b0' },
        rows: [
            '     #      ',
            ' #   #   #  ',
            '  #  #  #   ',
            '   ##+##    ',
            '   #+++#    ',
            ' ###+++###  ',
            '   #+++#    ',
            '   ##+##    ',
            '  #  #  #   ',
            ' #   #   #  ',
            '     #      '
        ]
    },
    moon: {
        colors: { '#': '#e7d6ff', '+': '#ffffff' },
        rows: [
            '            ',
            '    ####    ',
            '   ###      ',
            '  ###       ',
            '  ###       ',
            '  ###       ',
            '   ###      ',
            '    #####   ',
            '      ##    ',
            '            '
        ]
    },
    note: {
        colors: { '#': '#ffd45e', '+': '#fff2b0' },
        rows: [
            '     ##     ',
            '     #+#    ',
            '     #  #   ',
            '     #      ',
            '     #      ',
            '  ####      ',
            ' #####      ',
            '  ###       '
        ]
    },
    lock: {
        colors: { '#': '#b5a8d8', '+': '#453a60' },
        rows: [
            '            ',
            '    ####    ',
            '   #    #   ',
            '   #    #   ',
            '  ########  ',
            '  ###++###  ',
            '  ###++###  ',
            '  ########  ',
            '            '
        ]
    },
    hush: {
        colors: { '#': '#ec4d6e', '+': '#ffffff' },
        rows: [
            '#        # ',
            ' #  ++  #  ',
            '  # ++ #   ',
            '   #++#    ',
            '    ##     ',
            '    ##     ',
            '   #++#    ',
            '  # ++ #   ',
            ' #  ++  #  ',
            '#        # '
        ]
    },
    wait: {
        colors: { '#': '#7cc0f5', '+': '#ffffff' },
        rows: [
            '   ####    ',
            '  #    #   ',
            ' #  +   #  ',
            ' #  +   #  ',
            ' #  +++ #  ',
            ' #      #  ',
            '  #    #   ',
            '   ####    '
        ]
    },
    flag: {
        colors: { '#': '#6fe6cf', '+': '#ffffff' },
        rows: [
            ' +         ',
            ' +#####    ',
            ' +#######  ',
            ' +#######  ',
            ' +#####    ',
            ' +         ',
            ' +         ',
            ' +         ',
            '+++        '
        ]
    },
    crown: {
        colors: { '#': '#ffd45e', '+': '#ec4d6e' },
        rows: [
            '            ',
            ' #   ##   # ',
            ' ##  ##  ## ',
            ' ### ## ### ',
            ' ########## ',
            ' ##+####+## ',
            ' ########## ',
            '            '
        ]
    }
};

// The plain set used by the interface, nine pixels square so that they all sit
// alike. These are masks, so an icon always takes the color of the text beside it.
const UI_ICONS = {
    play: ['##.......', '####.....', '######...', '########.', '#########', '########.', '######...', '####.....', '##.......'],
    back: ['.........', '...#.....', '..##.....', '.########', '#########', '.########', '..##.....', '...#.....', '.........'],
    restart: ['..#####.#', '.#.....##', '#.....###', '#........', '#........', '#.......#', '#.......#', '.#.....#.', '..#####..'],
    gear: ['...###...', '.#.###.#.', '..#####..', '###...###', '###...###', '###...###', '..#####..', '.#.###.#.', '...###...'],
    keys: ['.........', '#########', '#.#.#.#.#', '#.#.#.#.#', '#.#.#.#.#', '#.#.#.#.#', '#.......#', '#########', '.........'],
    keyboard: ['.........', '#########', '#.#.#.#.#', '#########', '#.#.#.#.#', '#########', '#..###..#', '#########', '.........'],
    fullscreen: ['###...###', '#.......#', '#.......#', '.........', '.........', '.........', '#.......#', '#.......#', '###...###'],
    shrink: ['..#...#..', '..#...#..', '###...###', '.........', '.........', '.........', '###...###', '..#...#..', '..#...#..'],
    speaker: ['....#..#.', '...##...#', '#####.#.#', '#####.#.#', '#####.#.#', '#####.#.#', '#####.#.#', '...##...#', '....#..#.'],
    mute: ['....#....', '...##....', '#####....', '#####.#.#', '#####..#.', '#####.#.#', '#####....', '...##....', '....#....'],
    note: ['...######', '...######', '...#....#', '...#....#', '...#....#', '.###..###', '####.####', '####.####', '.##...##.'],
    tank: ['.........', '...####..', '..#####..', '..#######', '..#####..', '.#######.', '#########', '#.#.#.#.#', '.#######.'],
    bot: ['....#....', '....#....', '.#######.', '#.......#', '#.##.##.#', '#.......#', '#..###..#', '#.......#', '.#######.'],
    flag: ['.#.......', '.#####...', '.#######.', '.#######.', '.#####...', '.#.......', '.#.......', '.#.......', '###......'],
    clock: ['..#####..', '.#..#..#.', '#...#...#', '#...#...#', '#...###.#', '#.......#', '#.......#', '.#.....#.', '..#####..'],
    aim: ['....#....', '..#####..', '.#..#..#.', '.#.....#.', '###.#.###', '.#.....#.', '.#..#..#.', '..#####..', '....#....'],
    burst: ['#...#...#', '.#..#..#.', '..#.#.#..', '...###...', '#########', '...###...', '..#.#.#..', '.#..#..#.', '#...#...#'],
    box: ['#########', '#.......#', '#########', '#...#...#', '#..###..#', '#...#...#', '#.......#', '#.......#', '#########'],
    map: ['###..###.', '#..##..##', '#...#...#', '#...#...#', '#...#...#', '#...#...#', '#...#...#', '##..##..#', '.###..###'],
    home: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.#######.', '.##...##.', '.##...##.', '.##...##.'],
    plug: ['..#...#..', '..#...#..', '..#...#..', '#########', '#########', '.#######.', '..#####..', '....#....', '....#....'],
    check: ['.........', '........#', '.......##', '#.....##.', '##...##..', '.##.##...', '..###....', '...#.....', '.........'],
    cross: ['##.....##', '###...###', '.###.###.', '..#####..', '...###...', '..#####..', '.###.###.', '###...###', '##.....##'],
    random: ['..#####..', '.##...##.', '.##...##.', '.....##..', '....##...', '....##...', '.........', '....##...', '....##...'],
    eye: ['.........', '..#####..', '.#.....#.', '#..###..#', '#..###..#', '#..###..#', '.#.....#.', '..#####..', '.........'],
    swap: ['...#.....', '..##.....', '.#######.', '..##.....', '...#.#...', '.....##..', '.#######.', '.....##..', '.....#...'],
    wave: ['.........', '.##...##.', '#..#.#..#', '#..#.#..#', '...###...', '#..#.#..#', '#..#.#..#', '.##...##.', '.........'],
    left: ['...#.....', '..##.....', '.#######.', '#########', '.#######.', '..##.....', '...#.....', '.........', '.........'],
    right: ['.....#...', '.....##..', '.#######.', '#########', '.#######.', '.....##..', '.....#...', '.........', '.........']
};

ICONS.tank = { colors: { '#': '#f2e8d2' }, rows: UI_ICONS.tank };

const BULLET_ART = {
    shot: [
        '     ',
        '  ## ',
        ' #+## ',
        ' ####',
        '  ## '
    ],
    wrong: [
        '   #   ',
        '  ###  ',
        ' ##+## ',
        '##+++##',
        ' ##+## ',
        '  ###  ',
        '   #   '
    ],
    big: [
        '   ###   ',
        '  #####  ',
        ' ###++## ',
        '####+++##',
        '#########',
        '#########',
        ' ####### ',
        '  #####  ',
        '   ###   '
    ],
    hush: [
        '  ###  ',
        ' #   # ',
        '#  +  #',
        '# +++ #',
        '#  +  #',
        ' #   # ',
        '  ###  '
    ]
};

// =============================================================================
// PORTRAITS
// =============================================================================
// Dialogue portraits, 24 by 24 art pixels, drawn from a shared tank head
const PORTRAITS = {
    pip: { palette: 'blue', eyes: 'cute', top: 'antenna' },
    tock: { palette: 'gold', eyes: 'cute', top: 'metronome' },
    clef: { palette: 'ivory', eyes: 'sleepy', top: 'fork' },
    thump: { palette: 'rust', eyes: 'angry', top: 'hammer' },
    tremolo: { palette: 'teal', eyes: 'hollow', top: 'strings' },
    mute: { palette: 'hush', eyes: 'sleepy', top: 'felt' },
    key89: { palette: 'bruise', eyes: 'hollow', top: 'key' },
    pencil: { drawn: true }
};

/**
 * Build a dialogue portrait
 * @param {string} name - Key into PORTRAITS
 */
function portraitSprite(name) {
    return Sprites.cached(`portrait:${name}`, () => {
        const info = PORTRAITS[name] || PORTRAITS.pip;
        const canvas = makeCanvas(32, 32);
        const ctx = canvas.getContext('2d');
        const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };

        if (info.drawn) {
            // A worn stub of carpenter's pencil
            for (let i = 0; i < 18; i++) {
                rect(6 + i, 24 - i, 4, 4, '#eaa52a');
                rect(6 + i, 24 - i, 4, 1, '#ffd45e');
            }
            for (let i = 0; i < 4; i++) rect(20 + i + 2, 10 - i - 2, 4, 4, '#d8ccb0');
            rect(27, 3, 3, 3, OUTLINE_COLOR);
            rect(4, 26, 4, 4, '#ec5aa8');
            return Sprites.outlined(canvas);
        }

        const pal = TANK_PALETTES[info.palette];

        // Shoulders of the hull
        rect(6, 25, 20, 6, pal.m);
        rect(6, 25, 20, 1, pal.l);
        rect(8, 29, 16, 2, pal.d);

        // Crest, drawn behind the head
        if (info.top === 'antenna') {
            rect(15, 2, 2, 7, pal.d);
            Sprites.pixelCircle(ctx, 16, 3, 2, '#ffd45e');
        } else if (info.top === 'metronome') {
            for (let y = 1; y < 9; y++) rect(16 - y, y, y * 2, 1, y % 3 ? pal.m : pal.d);
            rect(18, 0, 2, 9, '#ffffff');
        } else if (info.top === 'fork') {
            rect(11, 1, 2, 9, '#ffffff');
            rect(19, 1, 2, 9, '#ffffff');
            rect(11, 8, 10, 2, '#ffffff');
        } else if (info.top === 'hammer') {
            rect(5, 1, 22, 7, pal.d);
            rect(6, 2, 20, 4, pal.l);
            rect(14, 6, 4, 4, pal.d);
        } else if (info.top === 'strings') {
            for (let x = 8; x < 25; x += 4) rect(x, 0, 1, 11, '#f2b98a');
        } else if (info.top === 'felt') {
            rect(4, 3, 24, 7, '#8a2f4a');
            rect(4, 3, 24, 2, '#b84a66');
        } else if (info.top === 'key') {
            rect(9, 0, 14, 9, '#14111f');
            rect(11, 1, 3, 7, '#3d3550');
        }

        // Head
        Sprites.pixelCircle(ctx, 16, 17, 10, pal.d);
        Sprites.pixelCircle(ctx, 16, 16, 9, pal.m);
        Sprites.pixelCircle(ctx, 14, 13, 5, pal.l);
        rect(11, 9, 4, 1, pal.h);

        // Eyes
        const eye = (x, flip) => {
            if (info.eyes === 'sleepy') {
                rect(x - 1, 18, 5, 2, OUTLINE_COLOR);
            } else if (info.eyes === 'hollow') {
                rect(x, 15, 4, 4, '#14111f');
                rect(x + 1, 16, 2, 2, '#ff5a7a');
            } else {
                rect(x, 15, 3, 5, OUTLINE_COLOR);
                rect(x, 15, 2, 2, '#ffffff');
                if (info.eyes === 'angry') {
                    rect(x - 1, flip ? 13 : 12, 5, 1, OUTLINE_COLOR);
                    rect(x - 1, flip ? 12 : 13, 2, 1, OUTLINE_COLOR);
                }
            }
        };
        eye(10, false);
        eye(19, true);

        // Cheeks and mouth
        if (info.eyes === 'cute') {
            rect(7, 20, 2, 1, '#ff9fd0');
            rect(23, 20, 2, 1, '#ff9fd0');
            rect(15, 21, 3, 1, OUTLINE_COLOR);
        } else if (info.eyes === 'angry') {
            rect(13, 22, 7, 1, OUTLINE_COLOR);
            rect(14, 21, 1, 1, OUTLINE_COLOR);
            rect(18, 21, 1, 1, OUTLINE_COLOR);
        }
        return Sprites.outlined(canvas);
    });
}

window.Sprites = Sprites;
