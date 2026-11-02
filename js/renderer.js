// =============================================================================
// GAME RENDERER MODULE
// =============================================================================
// Everything is drawn in art pixels onto a low-resolution canvas. World units are
// converted with toPixel, so that everything lands on the same grid.

function toPixel(value) {
    return Math.round(value / WORLD.PIXEL);
}

// Art pixels of the window taken up by the HUD at the top and the beat bar below
const HUD_TOP_PX = 25;
const HUD_BOTTOM_PX = 15;

const HUD_COLORS = {
    panel: '#1b1830',
    panelEdge: '#3d3550',
    text: '#f2e8d2',
    muted: '#a89ec0',
    health: '#7fdc6a',
    healthLow: '#ec4d6e',
    harmony: '#ffd45e',
    empty: '#352f4a'
};

class GameRenderer {
    constructor(game) {
        this.game = game;
        this.fogCanvas = null;
    }

    render() {
        const game = this.game;
        const { ctx } = game;
        if (!ctx || !game.map) return;
        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = game.map.theme.backdrop;
        ctx.fillRect(0, 0, game.viewW, game.viewH);

        const shakeX = game.shakeAmount ? (Math.random() - 0.5) * game.shakeAmount : 0;
        const shakeY = game.shakeAmount ? (Math.random() - 0.5) * game.shakeAmount : 0;
        const cameraX = toPixel(game.camera.x) + Math.round(shakeX);
        const cameraY = toPixel(game.camera.y) + Math.round(shakeY);
        this.cameraX = cameraX;
        this.cameraY = cameraY;

        ctx.save();
        ctx.translate(-cameraX, -cameraY);

        ctx.drawImage(game.map.layer, 0, 0);
        this.renderDynamicTiles(ctx);
        this.renderZones(ctx);
        this.renderTelegraphs(ctx);
        this.renderNotes(ctx);
        this.renderPowerups(ctx);
        this.renderTanks(ctx);
        this.renderBullets(ctx);
        this.renderBeam(ctx);
        this.renderParticles(ctx);
        this.renderRings(ctx);

        ctx.restore();

        if (!game.map.theme.lit) this.renderDarkness(ctx);

        ctx.save();
        ctx.translate(-cameraX, -cameraY);
        this.renderFloaters(ctx);
        ctx.restore();

        if (game.mode && game.mode.objectivePoint) this.renderObjectiveArrow(ctx);
        if (game.mouse && Prompts.usesMouse() && !game.dialog) this.renderReticle(ctx);
        this.renderHUD(ctx);
        this.renderBanner(ctx);
        if (game.dialog) this.renderDialog(ctx);
        if (game.clock < game.flashUntil) this.renderFlash(ctx);
    }

    /**
     * Run over the tiles currently on screen
     */
    forVisibleTiles(action) {
        const { map, viewW, viewH } = this.game;
        const size = WORLD.TILE_PX;
        const left = Math.max(0, Math.floor(this.cameraX / size));
        const top = Math.max(0, Math.floor(this.cameraY / size));
        const right = Math.min(map.cols - 1, Math.floor((this.cameraX + viewW) / size));
        const bottom = Math.min(map.rows - 1, Math.floor((this.cameraY + viewH) / size));
        for (let r = top; r <= bottom; r++) {
            for (let c = left; c <= right; c++) action(c, r, map.tiles[map.index(c, r)]);
        }
    }

    renderDynamicTiles(ctx) {
        const game = this.game;
        const { map } = game;
        const size = WORLD.TILE_PX;
        const ticking = Math.floor(game.clock / 160);
        const ringing = game.stringsActive();
        const warning = !ringing && (game.beat.position % 1) > 0.5;

        this.forVisibleTiles((c, r, type) => {
            const x = c * size;
            const y = r * size;
            if (type === TILES.CRATE) {
                const damage = CRATE_HEALTH - map.health[map.index(c, r)];
                ctx.drawImage(MapArt.crate(map, damage >= 3 ? 2 : (damage >= 1 ? 1 : 0)), x, y);
            } else if (type === TILES.DOOR) {
                this.drawDoor(ctx, x, y);
            } else if (type === TILES.STRING) {
                this.drawString(ctx, map, c, r, x, y, ringing, warning);
            } else if (type === TILES.GOAL) {
                this.drawGoal(ctx, x, y);
            } else if (type === TILES.KEYPAD) {
                const lit = (game.keypadGlow.get(map.index(c, r)) || 0) > game.clock;
                ctx.fillStyle = lit ? '#ffd45e' : '#fff7e6';
                ctx.fillRect(x + 1, y + 1, 14, 14);
                ctx.fillStyle = lit ? '#eaa52a' : '#c9bb9d';
                ctx.fillRect(x + 1, y + 13, 14, 2);
                ctx.fillRect(x + 14, y + 1, 1, 14);
            } else if (type >= TILES.BOOST_N && type <= TILES.BOOST_W) {
                this.drawBoost(ctx, x, y, BOOST_DIRECTIONS[type], ticking);
            }
        });
    }

    drawDoor(ctx, x, y) {
        ctx.fillStyle = '#5c2a22';
        ctx.fillRect(x, y, 16, 16);
        ctx.fillStyle = '#9a4a30';
        ctx.fillRect(x + 1, y + 1, 14, 14);
        ctx.fillStyle = '#5c2a22';
        ctx.fillRect(x + 5, y, 1, 16);
        ctx.fillRect(x + 10, y, 1, 16);
        ctx.fillStyle = '#ffd45e';
        ctx.fillRect(x + 6, y + 6, 4, 4);
        ctx.fillStyle = OUTLINE_COLOR;
        ctx.fillRect(x + 7, y + 7, 2, 2);
    }

    drawString(ctx, map, c, r, x, y, ringing, warning) {
        const vertical = map.vertical[map.index(c, r)];
        const wobble = ringing ? Math.round(Math.sin(this.game.clock / 22 + (vertical ? r : c)) * 2) : 0;
        const main = ringing ? '#fff2b0' : (warning ? '#ffb066' : '#c8854a');
        const edge = ringing ? '#ffd45e' : '#6a3e22';
        if (vertical) {
            ctx.fillStyle = edge;
            ctx.fillRect(x + 7 + wobble, y, 3, 16);
            ctx.fillStyle = main;
            ctx.fillRect(x + 8 + wobble, y, 1, 16);
        } else {
            ctx.fillStyle = edge;
            ctx.fillRect(x, y + 7 + wobble, 16, 3);
            ctx.fillStyle = main;
            ctx.fillRect(x, y + 8 + wobble, 16, 1);
        }
    }

    drawGoal(ctx, x, y) {
        const glow = Math.floor(this.game.clock / 200) % 2;
        ctx.fillStyle = glow ? '#ffd45e' : '#eaa52a';
        ctx.fillRect(x + 1, y + 1, 14, 14);
        ctx.fillStyle = OUTLINE_COLOR;
        for (let i = 0; i < 5; i++) ctx.fillRect(x + 3, y + 3 + i * 2 + (i > 2 ? 1 : 0), 10, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 6, y + 6, 3, 3);
    }

    drawBoost(ctx, x, y, [dx, dy], ticking) {
        ctx.fillStyle = 'rgba(114, 230, 207, 0.35)';
        ctx.fillRect(x, y, 16, 16);
        for (let i = 0; i < 3; i++) {
            const shift = (i * 5 + ticking) % 15;
            ctx.fillStyle = i === ticking % 3 ? '#ffffff' : '#6fe6cf';
            if (dx) {
                const px = dx > 0 ? x + shift : x + 15 - shift;
                ctx.fillRect(px, y + 4, 1, 8);
                ctx.fillRect(px - dx, y + 6, 1, 4);
            } else {
                const py = dy > 0 ? y + shift : y + 15 - shift;
                ctx.fillRect(x + 4, py, 8, 1);
                ctx.fillRect(x + 6, py - dy, 4, 1);
            }
        }
    }

    renderZones(ctx) {
        const game = this.game;
        const zones = (game.mode && game.mode.zones) || [];
        zones.forEach(zone => {
            const x = toPixel(zone.x);
            const y = toPixel(zone.y);
            const radius = toPixel(zone.radius);
            ctx.globalAlpha = 0.55;
            Sprites.pixelCircle(ctx, x, y, radius, '#0f0b18');
            ctx.globalAlpha = 1;
            this.pixelRing(ctx, x, y, radius, '#7566a0');
        });
    }

    renderTelegraphs(ctx) {
        const game = this.game;
        game.telegraphs.forEach(mark => {
            const progress = (game.clock - mark.start) / (mark.end - mark.start);
            const pulse = Math.floor(game.clock / 90) % 2;
            if (mark.radius) {
                const x = toPixel(mark.follow ? mark.follow.x : mark.x);
                const y = toPixel(mark.follow ? mark.follow.y : mark.y);
                const radius = toPixel(mark.radius);
                ctx.globalAlpha = 0.2;
                Sprites.pixelCircle(ctx, x, y, radius, '#ff4d6d');
                ctx.globalAlpha = 0.42;
                Sprites.pixelCircle(ctx, x, y, Math.max(1, Math.round(radius * progress)), '#ff4d6d');
                ctx.globalAlpha = 1;
                this.pixelRing(ctx, x, y, radius, pulse ? '#ffffff' : '#ff4d6d');
            } else {
                ctx.save();
                ctx.translate(toPixel(mark.x), toPixel(mark.y));
                ctx.rotate(mark.angle);
                const length = toPixel(mark.length);
                const width = toPixel(mark.width);
                ctx.globalAlpha = 0.22;
                ctx.fillStyle = '#ff4d6d';
                ctx.fillRect(0, -width / 2, length, width);
                ctx.globalAlpha = 0.5;
                ctx.fillRect(0, -width / 2, length * progress, width);
                ctx.globalAlpha = 1;
                ctx.fillStyle = pulse ? '#ffffff' : '#ff4d6d';
                ctx.fillRect(0, -width / 2, length, 1);
                ctx.fillRect(0, width / 2, length, 1);
                ctx.restore();
            }
        });
    }

    renderBeam(ctx) {
        const game = this.game;
        const beam = game.beam;
        if (!beam || game.clock > beam.end) return;
        ctx.save();
        ctx.translate(toPixel(beam.x), toPixel(beam.y));
        ctx.rotate(beam.angle);
        const width = toPixel(beam.width);
        ctx.fillStyle = '#ffd45e';
        ctx.fillRect(0, -width / 2, toPixel(beam.length), width);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -2, toPixel(beam.length), 4);
        ctx.restore();
    }

    renderNotes(ctx) {
        const game = this.game;
        const notes = (game.mode && game.mode.notes) || [];
        const icon = Sprites.icon('note');
        notes.forEach((note, i) => {
            if (note.taken) return;
            const bob = Math.round(Math.sin(game.clock / 240 + i) * 2);
            ctx.drawImage(icon, toPixel(note.x) - 6, toPixel(note.y) - 5 + bob);
        });
    }

    renderPowerups(ctx) {
        const game = this.game;
        game.powerups.forEach((powerup, i) => {
            const remaining = powerup.expiresAt - game.clock;
            if (remaining < 3000 && Math.floor(game.clock / 120) % 2) return; // Blink before vanishing
            const x = toPixel(powerup.x);
            const y = toPixel(powerup.y) + Math.round(Math.sin(game.clock / 200 + i) * 1.5);
            ctx.fillStyle = OUTLINE_COLOR;
            ctx.fillRect(x - 9, y - 9, 18, 18);
            ctx.fillStyle = '#f2e8d2';
            ctx.fillRect(x - 8, y - 8, 16, 16);
            ctx.fillStyle = '#c9bb9d';
            ctx.fillRect(x - 8, y + 6, 16, 2);
            const icon = Sprites.icon(GAME_CONFIG.POWERUP_TYPES[powerup.type].icon);
            ctx.drawImage(icon, x - Math.ceil(icon.width / 2), y - Math.ceil(icon.height / 2));
        });
    }

    renderTanks(ctx) {
        const game = this.game;
        // Lower tanks are drawn last so that they sit in front
        const order = game.tanks.filter(tank => tank.isAlive).sort((a, b) => a.y - b.y);
        order.forEach(tank => {
            if (tank.boss) this.drawBoss(ctx, tank);
            else this.drawTank(ctx, tank);
        });
    }

    drawTank(ctx, tank) {
        const game = this.game;
        const hidden = game.hasStatus(tank, 'hidden');
        const protectedBlink = game.hasStatus(tank, 'spawnProtect') && Math.floor(game.clock / 90) % 2;

        const x = toPixel(tank.x);
        const y = toPixel(tank.y);
        const chassis = CHASSIS[tank.chassis];
        const flash = tank.hurtUntil > game.clock || (tank.fuseAt && Math.floor(game.clock / 70) % 2);
        const palette = flash ? 'white' : tank.palette;
        const direction = ((Math.round(tank.angle / (Math.PI / 4)) % 8) + 8) % 8;
        const frame = Math.floor(tank.distance / 9) % 2;

        if (hidden) ctx.globalAlpha = 0.14;
        else if (protectedBlink) ctx.globalAlpha = 0.45;

        // Sight line before a Sharp fires
        if (tank.sightLine) this.drawSightLine(ctx, tank);

        const half = chassis.grid / 2;
        ctx.drawImage(Sprites.hullShadow(tank.chassis, direction), x - half, y - half + 2);

        ctx.drawImage(Sprites.hull(tank.chassis, palette, direction, frame), x - half, y - half);

        const recoil = tank.recoilUntil > game.clock ? 2 : 0;
        drawTankBarrel(ctx, x, y, tank.turretAngle, chassis, TANK_PALETTES[palette], chassis.barrel, recoil);

        if (tank.muzzleUntil > game.clock) {
            const reach = chassis.barrelLength + 2;
            ctx.fillStyle = '#fff2b0';
            const mx = Math.round(x + Math.cos(tank.turretAngle) * reach);
            const my = Math.round(y + Math.sin(tank.turretAngle) * reach);
            ctx.fillRect(mx - 2, my - 2, 5, 5);
        }

        const dome = Sprites.dome(tank.chassis, palette);
        ctx.drawImage(dome, x - Math.floor(dome.width / 2), y - Math.floor(dome.height / 2));

        const blinking = (Math.floor((game.clock + tank.x) / 180) % 20) === 0 || game.hasStatus(tank, 'sleep');
        drawTankFace(ctx, x, y, tank.turretAngle, chassis, tank.eyes, blinking ? 1 : 0);
        ctx.globalAlpha = 1;

        this.drawTankOverlays(ctx, tank, x, y, chassis);
    }

    drawTankOverlays(ctx, tank, x, y, chassis) {
        const game = this.game;
        const top = y - chassis.width / 2 - 5;

        if (game.hasStatus(tank, 'shield') || (tank.powerups && tank.powerups.invincibility.length)) {
            const radius = Math.ceil(tank.size / 6) + 6 + (Math.floor(game.clock / 120) % 2);
            const color = tank.powerups && tank.powerups.invincibility.length ? '#ffd45e' : '#7cc0f5';
            this.pixelRing(ctx, x, y, radius, color);
            // One pip for each hit the shield can still take
            for (let i = 0; i < tank.shieldHits && game.hasStatus(tank, 'shield'); i++) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x - Math.round(tank.shieldHits * 1.5) + i * 3, y + radius + 2, 2, 2);
            }
        }
        if (game.hasStatus(tank, 'sleep')) {
            Sprites.text(ctx, 'z', x + 7, top - 8 - Math.floor(game.clock / 200) % 4, { color: '#e7d6ff', size: 10, shadow: OUTLINE_COLOR });
        }
        if (game.hasStatus(tank, 'silence')) {
            ctx.fillStyle = '#ec4d6e';
            ctx.fillRect(x - 5, top - 3, 10, 1);
        }

        const showHealth = tank.health < tank.maxHealth && !game.hasStatus(tank, 'hidden');
        if (showHealth) {
            const width = Math.max(12, chassis.length - 2);
            const left = x - Math.round(width / 2);
            ctx.fillStyle = OUTLINE_COLOR;
            ctx.fillRect(left - 1, top - 1, width + 2, 3);
            ctx.fillStyle = HUD_COLORS.empty;
            ctx.fillRect(left, top, width, 1);
            const fraction = Math.max(0, tank.health / tank.maxHealth);
            ctx.fillStyle = fraction < 0.34 ? HUD_COLORS.healthLow : HUD_COLORS.health;
            ctx.fillRect(left, top, Math.ceil(width * fraction), 1);
        }

        if (!tank.enemyType && !tank.isBuddy && !tank.inert) {
            const label = tank.isPlayer ? `P${(typeof tank.id === 'number' ? tank.id : 0) + 1}` : tank.name;
            Sprites.text(ctx, label, x, top - 12, {
                color: tank.isPlayer ? '#ffffff' : TANK_PALETTES[tank.palette].l,
                size: 10,
                align: 'center',
                shadow: OUTLINE_COLOR
            });
        }
    }

    drawSightLine(ctx, tank) {
        const game = this.game;
        const step = 12;
        const color = tank.sightLine === 'locked' ? '#ffffff' : '#ff4d6d';
        const cos = Math.cos(tank.turretAngle);
        const sin = Math.sin(tank.turretAngle);
        ctx.fillStyle = color;
        for (let d = 36; d < 900; d += step) {
            const wx = tank.x + cos * d;
            const wy = tank.y + sin * d;
            if (game.map.blocksBullet(game.map.tileAt(wx, wy))) break;
            if ((d + Math.floor(game.clock / 40) * 3) % 24 < 12) ctx.fillRect(toPixel(wx), toPixel(wy), 1, 1);
        }
    }

    drawBoss(ctx, boss) {
        const game = this.game;
        let wx = boss.x;
        let wy = boss.y;
        let lift = 0;
        if (boss.leapArc) {
            const arc = boss.leapArc;
            const crouch = arc.crouch || 0;
            const t = Math.max(0, Math.min(1, (game.clock - arc.start - crouch) / (arc.duration - crouch)));
            wx = arc.fromX + (arc.x - arc.fromX) * t;
            wy = arc.fromY + (arc.y - arc.fromY) * t;
            lift = Math.round(Math.sin(t * Math.PI) * 56);
            // Winding up: sinks a little and trembles before it goes
            if (t === 0 && crouch) {
                const held = (game.clock - arc.start) / crouch;
                lift = -Math.round(held * 3);
                wx += Math.floor(game.clock / 45) % 2 ? 3 : -3;
            }
        }
        const x = toPixel(wx);
        const y = toPixel(wy);
        const flash = boss.hurtUntil > game.clock;
        const palette = flash ? 'white' : boss.palette;
        const pal = TANK_PALETTES[palette];

        const half = Math.round(boss.size / 6);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x - half, y + half - 3, half * 2, Math.max(4, 8 - Math.round(lift / 12)));

        const by = y - lift;
        if (boss.boss === 'key89') this.drawKeyBoss(ctx, boss, x, by, pal);
        else this.drawTankBoss(ctx, boss, x, by, palette, pal);

        if (game.hasStatus(boss, 'stun')) {
            for (let i = 0; i < 4; i++) {
                const angle = game.clock / 170 + i * Math.PI / 2;
                ctx.fillStyle = '#ffd45e';
                ctx.fillRect(Math.round(x + Math.cos(angle) * 18), Math.round(by - half + Math.sin(angle) * 5), 3, 3);
            }
        }
        if (game.hasStatus(boss, 'sleep')) {
            Sprites.text(ctx, 'zzz', x, by - half - 12, { color: '#e7d6ff', align: 'center', shadow: OUTLINE_COLOR });
        }
    }

    drawTankBoss(ctx, boss, x, y, palette, pal) {
        const game = this.game;
        const chassisKey = { thump: 'bossThump', tremolo: 'bossTremolo', mute: 'bossMute' }[boss.boss];
        const chassis = CHASSIS[chassisKey];
        const direction = ((Math.round(boss.angle / (Math.PI / 4)) % 8) + 8) % 8;
        const frame = Math.floor(boss.distance / 12) % 2;
        const half = chassis.grid / 2;

        if (boss.boss === 'tremolo') {
            // Eight long legs that tap out a tremolo
            for (let i = 0; i < 8; i++) {
                const base = (i + 0.5) * Math.PI / 4;
                const tap = Math.sin(game.clock / 90 + i * 2) * 0.1;
                const kneeX = x + Math.cos(base + tap) * 20;
                const kneeY = y + Math.sin(base + tap) * 16 - 3;
                stampLine(ctx, x, y, Math.atan2(kneeY - y, kneeX - x), Math.hypot(kneeX - x, kneeY - y), 3, OUTLINE_COLOR);
                stampLine(ctx, kneeX, kneeY, base + tap, 8, 3, OUTLINE_COLOR);
                stampLine(ctx, x, y, Math.atan2(kneeY - y, kneeX - x), Math.hypot(kneeX - x, kneeY - y), 1, pal.l);
                stampLine(ctx, kneeX, kneeY, base + tap, 8, 1, pal.l);
            }
        }

        ctx.drawImage(Sprites.hull(chassisKey, palette, direction, frame), x - half, y - half);

        if (boss.boss === 'mute') {
            // The felt pad on the front is the part that shots cannot get through
            if (boss.frontArmor) {
                const facing = boss.armorAngle;
                const perp = facing + Math.PI / 2;
                const px = x + Math.cos(facing) * 19;
                const py = y + Math.sin(facing) * 19;
                for (let i = -12; i <= 12; i++) {
                    stampLine(ctx, px + Math.cos(perp) * i, py + Math.sin(perp) * i, facing, 4, 2, OUTLINE_COLOR);
                }
                for (let i = -11; i <= 11; i++) {
                    stampLine(ctx, px + Math.cos(perp) * i, py + Math.sin(perp) * i, facing, 3, 1, i % 4 ? '#b84a66' : '#8a2f4a');
                }
            }
        } else {
            drawTankBarrel(ctx, x, y, boss.turretAngle, chassis, pal, chassis.barrel, boss.recoilUntil > game.clock ? 3 : 0);
        }

        if (boss.boss === 'thump') {
            // A great rusty hammer head on the end of the gun
            const reach = chassis.barrelLength + 3;
            const hx = x + Math.cos(boss.turretAngle) * reach;
            const hy = y + Math.sin(boss.turretAngle) * reach;
            const perp = boss.turretAngle + Math.PI / 2;
            const sx = hx - Math.cos(perp) * 10;
            const sy = hy - Math.sin(perp) * 10;
            stampLine(ctx, sx, sy, perp, 20, 11, OUTLINE_COLOR);
            stampLine(ctx, sx, sy, perp, 20, 9, pal.d);
            stampLine(ctx, sx, sy, perp, 20, 5, pal.m);
            stampLine(ctx, sx, sy, perp, 20, 2, pal.l);
        }

        const dome = Sprites.dome(chassisKey, palette);
        ctx.drawImage(dome, x - Math.floor(dome.width / 2), y - Math.floor(dome.height / 2));
        const blink = (Math.floor(game.clock / 180) % 24) === 0 ? 1 : 0;
        const eyes = boss.boss === 'tremolo' ? 'hollow' : (boss.boss === 'mute' ? 'sleepy' : 'angry');
        drawTankFace(ctx, x, y, boss.turretAngle, chassis, eyes, blink);
    }

    /**
     * The Eighty-Ninth Key is not a tank at all. It floats, cracked and glowing.
     */
    drawKeyBoss(ctx, boss, x, y, pal) {
        const game = this.game;
        const bob = Math.round(Math.sin(game.clock / 300) * 2);
        const resolved = boss.palette === 'gold';
        const top = y - 24 + bob;
        const rect = (px, py, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(px, py, w, h); };

        rect(x - 13, top - 1, 26, 44, OUTLINE_COLOR);
        rect(x - 12, top, 24, 42, resolved ? '#fff7e6' : '#2a2438');
        rect(x - 12, top, 4, 42, resolved ? '#ffffff' : '#3f3754');
        rect(x - 12, top + 38, 24, 4, resolved ? '#c9bb9d' : '#15121f');

        if (!resolved) {
            // The crack that everything leaked out of
            const glow = Math.floor(game.clock / 110) % 2 ? '#ec8cf8' : pal.h;
            [[2, 2], [0, 8], [3, 14], [1, 21], [4, 28], [2, 34]].forEach(([dx, dy], i) => {
                rect(x + dx - 3, top + dy, 2, 7, glow);
                if (i % 2) rect(x + dx - 1, top + dy + 2, 3, 1, glow);
            });
        }

        // Its one eye
        const eyeY = top + 13;
        rect(x - 7, eyeY, 14, 8, OUTLINE_COLOR);
        rect(x - 6, eyeY + 1, 12, 6, resolved ? '#ffd45e' : '#14111f');
        const gaze = Math.round(Math.cos(boss.turretAngle) * 3);
        rect(x - 2 + gaze, eyeY + 2, 4, 4, resolved ? OUTLINE_COLOR : '#ff5a7a');

        if (boss.resolving && !resolved) {
            const ring = 28 + Math.floor(game.clock / 90) % 6;
            this.pixelRing(ctx, x, y, ring, '#ffd45e');
        }
    }

    renderBullets(ctx) {
        const game = this.game;
        game.bullets.forEach(bullet => {
            const sprite = Sprites.bullet(bullet.kind, bullet.color);
            ctx.drawImage(sprite, toPixel(bullet.x) - Math.floor(sprite.width / 2), toPixel(bullet.y) - Math.floor(sprite.height / 2));
        });
    }

    renderParticles(ctx) {
        this.game.particles.forEach(particle => {
            const size = Math.max(1, Math.round(particle.size / WORLD.PIXEL * (particle.life / particle.maxLife) + 0.5));
            ctx.fillStyle = particle.color;
            ctx.fillRect(toPixel(particle.x), toPixel(particle.y), size, size);
        });
    }

    renderRings(ctx) {
        const game = this.game;
        game.rings.forEach(ring => {
            const t = (game.clock - ring.start) / (ring.end - ring.start);
            this.pixelRing(ctx, toPixel(ring.x), toPixel(ring.y), Math.round(toPixel(ring.radius) * t), ring.color);
        });
    }

    /**
     * Draw a one pixel thick circle
     */
    pixelRing(ctx, cx, cy, radius, color) {
        ctx.fillStyle = color;
        let x = radius;
        let y = 0;
        let error = 1 - radius;
        while (x >= y) {
            ctx.fillRect(cx + x, cy + y, 1, 1);
            ctx.fillRect(cx + y, cy + x, 1, 1);
            ctx.fillRect(cx - y, cy + x, 1, 1);
            ctx.fillRect(cx - x, cy + y, 1, 1);
            ctx.fillRect(cx - x, cy - y, 1, 1);
            ctx.fillRect(cx - y, cy - x, 1, 1);
            ctx.fillRect(cx + y, cy - x, 1, 1);
            ctx.fillRect(cx + x, cy - y, 1, 1);
            y++;
            if (error < 0) {
                error += 2 * y + 1;
            } else {
                x--;
                error += 2 * (y - x) + 1;
            }
        }
    }

    renderFloaters(ctx) {
        const game = this.game;
        game.floaters.forEach(floater => {
            const t = (game.clock - floater.start) / (floater.end - floater.start);
            if (floater.icon) {
                const icon = Sprites.icon(floater.icon);
                ctx.drawImage(icon, toPixel(floater.x) - Math.floor(icon.width / 2), toPixel(floater.y) - Math.round(t * 12));
                return;
            }
            Sprites.text(ctx, floater.text, toPixel(floater.x), toPixel(floater.y) - Math.round(t * 12), {
                color: floater.color,
                size: floater.size,
                align: 'center',
                shadow: OUTLINE_COLOR
            });
        });
    }

    /**
     * The Felt Hollows are dark. Only the crew and what they fire give any light.
     */
    renderDarkness(ctx) {
        const game = this.game;
        if (!this.fogCanvas || this.fogCanvas.width !== game.viewW || this.fogCanvas.height !== game.viewH) {
            this.fogCanvas = makeCanvas(game.viewW, game.viewH);
        }
        const fog = this.fogCanvas.getContext('2d');
        fog.globalCompositeOperation = 'source-over';
        fog.clearRect(0, 0, game.viewW, game.viewH);
        fog.fillStyle = 'rgba(9, 6, 17, 0.9)';
        fog.fillRect(0, 0, game.viewW, game.viewH);
        fog.globalCompositeOperation = 'destination-out';

        const light = this.lightSprite(78);
        const small = this.lightSprite(34);
        const stamp = (sprite, wx, wy) => {
            fog.drawImage(sprite, toPixel(wx) - this.cameraX - sprite.width / 2, toPixel(wy) - this.cameraY - sprite.height / 2);
        };
        game.tanks.forEach(tank => {
            if (tank.isAlive && tank.faction === 'crew') stamp(light, tank.x, tank.y);
            else if (tank.isAlive && tank.boss) stamp(light, tank.x, tank.y);
        });
        game.bullets.forEach(bullet => stamp(small, bullet.x, bullet.y));
        game.powerups.forEach(powerup => stamp(small, powerup.x, powerup.y));
        const mode = game.mode;
        if (mode.notes) mode.notes.forEach(note => { if (!note.taken) stamp(small, note.x, note.y); });
        if (mode.goalTiles) mode.goalTiles.forEach(tile => stamp(small, (tile.c + 0.5) * WORLD.TILE, (tile.r + 0.5) * WORLD.TILE));
        if (mode.doors) mode.doors.forEach(door => { if (!door.open) stamp(small, door.x, door.y); });

        ctx.drawImage(this.fogCanvas, 0, 0);
    }

    /**
     * A round light with a dithered edge, to stay in keeping with the pixel art
     */
    lightSprite(radius) {
        return Sprites.cached(`light:${radius}`, () => {
            const size = radius * 2;
            const canvas = makeCanvas(size, size);
            const ctx = canvas.getContext('2d');
            const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
            ctx.fillStyle = '#000000';
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const distance = Math.hypot(x - radius, y - radius) / radius;
                    const threshold = (bayer[y % 4][x % 4] + 0.5) / 16;
                    if (1 - distance * distance > threshold) ctx.fillRect(x, y, 1, 1);
                }
            }
            return canvas;
        });
    }

    /**
     * Where the mouse is aiming
     */
    renderReticle(ctx) {
        const x = Math.round(this.game.mouse.x);
        const y = Math.round(this.game.mouse.y);
        const arms = [[-6, -1, 4, 3], [3, -1, 4, 3], [-1, -6, 3, 4], [-1, 3, 3, 4]];
        ctx.fillStyle = OUTLINE_COLOR;
        arms.forEach(([dx, dy, w, h]) => ctx.fillRect(x + dx, y + dy, w, h));
        ctx.fillStyle = '#ffd45e';
        arms.forEach(([dx, dy, w, h]) => ctx.fillRect(x + dx + (w > 3 ? 0 : 1), y + dy + (h > 3 ? 0 : 1), w > 3 ? w : 1, h > 3 ? h : 1));
    }

    renderObjectiveArrow(ctx) {
        const game = this.game;
        if (game.dialog || game.mode.finished) return;
        const point = game.mode.objectivePoint(game);
        if (!point) return;
        const x = toPixel(point.x) - this.cameraX;
        const y = toPixel(point.y) - this.cameraY;
        const pad = 26;
        if (x > pad && y > pad && x < game.viewW - pad && y < game.viewH - pad) return;

        const cx = game.viewW / 2;
        const cy = game.viewH / 2;
        const angle = Math.atan2(y - cy, x - cx);
        const reachX = (cx - pad) / Math.max(0.001, Math.abs(Math.cos(angle)));
        const reachY = (cy - pad - 12) / Math.max(0.001, Math.abs(Math.sin(angle)));
        const reach = Math.min(reachX, reachY);
        const ax = cx + Math.cos(angle) * reach;
        const ay = cy + Math.sin(angle) * reach;
        const bob = Math.floor(game.clock / 200) % 2;

        for (let i = 0; i < 6; i++) {
            const length = 6 - i;
            const px = ax + Math.cos(angle) * (i + bob) - Math.cos(angle + Math.PI / 2) * length;
            const py = ay + Math.sin(angle) * (i + bob) - Math.sin(angle + Math.PI / 2) * length;
            stampLine(ctx, px, py, angle + Math.PI / 2, length * 2, 2, OUTLINE_COLOR);
        }
        for (let i = 0; i < 5; i++) {
            const length = 4 - i * 0.8;
            const px = ax + Math.cos(angle) * (i + bob) - Math.cos(angle + Math.PI / 2) * length;
            const py = ay + Math.sin(angle) * (i + bob) - Math.sin(angle + Math.PI / 2) * length;
            stampLine(ctx, px, py, angle + Math.PI / 2, length * 2, 1, '#ffd45e');
        }
    }

    // -------------------------------------------------------------------------
    // HUD
    // -------------------------------------------------------------------------

    renderHUD(ctx) {
        const game = this.game;
        const hud = game.mode && game.mode.hudInfo ? game.mode.hudInfo(game) : { lines: [] };

        // Everything sits on one bar along the top edge
        ctx.fillStyle = HUD_COLORS.panel;
        ctx.fillRect(0, 0, game.viewW, 24);
        ctx.fillStyle = HUD_COLORS.panelEdge;
        ctx.fillRect(0, 24, game.viewW, 1);

        let x = 2;
        game.players.forEach((tank, i) => {
            this.renderPlayerPanel(ctx, tank, i, x);
            x += 84;
        });
        if (game.players.length === 0) {
            ctx.drawImage(Sprites.icon('wait'), 6, 6);
        }

        const right = game.viewW - 4;
        if (hud.title) Sprites.text(ctx, hud.title, right, -1, { color: HUD_COLORS.text, align: 'right' });
        if (hud.icon) {
            const detail = hud.detail === undefined ? '' : String(hud.detail);
            const width = Sprites.textWidth(detail);
            const icon = Sprites.icon(hud.icon);
            ctx.drawImage(icon, right - width - icon.width - 2, 11);
            Sprites.text(ctx, detail, right, 10, { color: HUD_COLORS.harmony, align: 'right' });
        }
        if (hud.spares !== undefined && game.numPlayers > 0) {
            this.renderSpares(ctx, hud.spares, x + 2);
        }

        const boss = game.mode && game.mode.bossTank;
        if (boss && boss.isAlive && !boss.resolving) this.renderBossBar(ctx, boss);

        this.renderBeatBar(ctx);

        const door = game.mode && game.mode.nearDoor;
        if (door && game.mode.level.door) this.renderDoorHint(ctx, game.mode.level.door);
    }

    renderPlayerPanel(ctx, tank, index, x) {
        const game = this.game;
        const pal = TANK_PALETTES[tank.palette];
        const barWidth = 42;

        ctx.fillStyle = pal.m;
        ctx.fillRect(x, 1, 2, 22);
        const preview = Sprites.dome('player', tank.palette);
        ctx.drawImage(preview, x + 3, 6);
        if (tank.isAlive) drawTankFace(ctx, x + 8, 11, 0, CHASSIS.player, 'cute', 0);

        Sprites.text(ctx, `P${index + 1}`, x + 16, -2, { color: HUD_COLORS.text });

        // Health
        const hx = x + 30;
        ctx.fillStyle = HUD_COLORS.empty;
        ctx.fillRect(hx, 3, barWidth, 4);
        const health = Math.max(0, tank.health / tank.maxHealth);
        ctx.fillStyle = health < 0.34 ? HUD_COLORS.healthLow : HUD_COLORS.health;
        ctx.fillRect(hx, 3, Math.ceil(barWidth * health), 4);

        // Harmony meter, marked at the cost of the cheapest chord
        // None of this means anything until the crew has learned something to play
        if (game.harmonyInPlay()) {
            ctx.fillStyle = HUD_COLORS.empty;
            ctx.fillRect(hx, 9, barWidth, 3);
            ctx.fillStyle = HUD_COLORS.harmony;
            ctx.fillRect(hx, 9, Math.floor(barWidth * tank.meter / GAME_CONFIG.METER_MAX), 3);

            // Harmony keys, lit while held, and groove beside them
            const held = game.harmony[index] ? game.harmony[index].held : new Set();
            for (let k = 1; k <= 5; k++) {
                ctx.fillStyle = held.has(k) ? '#ffd45e' : '#f2e8d2';
                ctx.fillRect(hx + (k - 1) * 5, 14, 4, 6);
            }
        }
        for (let g = 0; g < GAME_CONFIG.GROOVE_MAX && !game.beatless; g++) {
            ctx.fillStyle = g < tank.groove ? '#ff9fd0' : HUD_COLORS.empty;
            ctx.fillRect(hx + 28 + g * 3, 14, 2, 6);
        }

        this.renderPowerupTabs(ctx, tank, x);

        if (!tank.isAlive) {
            ctx.fillStyle = 'rgba(27, 24, 48, 0.72)';
            ctx.fillRect(x, 0, 74, 24);
        }
    }

    /**
     * Active powerups hang from the top bar, with a fuse running down under each
     * one and a pip for every stack past the first
     */
    renderPowerupTabs(ctx, tank, x) {
        const slots = [
            ['invincibility', 'star', GAME_CONFIG.POWERUP_STAR_MS], ['speed', 'wing'], ['rapidFire', 'notes'],
            ['spreadShot', 'triple'], ['bouncingBullets', 'spring']
        ];
        let left = x;
        slots.forEach(([key, iconName, full = GAME_CONFIG.POWERUP_DURATION]) => {
            const stack = tank.powerups[key];
            if (!stack.length) return;
            const icon = Sprites.icon(iconName);
            ctx.fillStyle = HUD_COLORS.panel;
            ctx.fillRect(left, 25, 18, 16);
            ctx.drawImage(icon, left + 1, 26);
            ctx.fillStyle = HUD_COLORS.harmony;
            ctx.fillRect(left, 40, Math.ceil(18 * Math.min(1, Math.max(...stack) / full)), 1);
            for (let i = 1; i < stack.length; i++) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(left + 15, 26 + (i - 1) * 3, 2, 2);
            }
            left += 19;
        });
    }

    /**
     * Everything the player can play, along the bottom bar. Each fills back in from
     * the bottom as its cooldown runs out, and stays dim without the harmony for it.
     * With more than two players there is only room for the chords.
     */
    renderChordBar(ctx) {
        const game = this.game;
        const y = game.viewH - 14;
        const letters = !Prompts.usingPiano();
        const crowded = game.players.length > 2;
        game.players.forEach((tank, index) => {
            const moves = [
                ...Object.entries(HARMONY_CONFIG.CHORDS),
                ...(crowded ? [] : Object.entries(HARMONY_CONFIG.MELODIES))
            ].filter(([name]) => game.abilityAvailable(tank, name));
            const step = 15;
            const chordStep = letters ? 23 : step;
            const row = chordStep * 4 + (crowded ? 0 : step * 4) + 4;
            let x = index % 2 === 0 ? 4 + (index / 2) * row : game.viewW - 4 - row * ((index + 1) / 2);

            moves.forEach(([name, move]) => {
                const icon = Sprites.icon(move.icon);
                ctx.globalAlpha = Abilities.ready(game, tank, name) ? 1 : 0.35;
                ctx.drawImage(icon, x, y);
                ctx.globalAlpha = 1;

                const left = (tank.cooldowns[name] || 0) - game.clock;
                if (left > 0) {
                    const height = Math.ceil(13 * Math.min(1, left / move.cooldown));
                    ctx.fillStyle = 'rgba(27, 24, 48, 0.8)';
                    ctx.fillRect(x, y, 14, height);
                }
                if (tank.deniedUntil && tank.deniedUntil[name] > game.clock) {
                    ctx.fillStyle = 'rgba(236, 77, 110, 0.6)';
                    ctx.fillRect(x, y, 14, 13);
                }
                const isChord = !!HARMONY_CONFIG.CHORDS[name];
                if (letters && isChord) Sprites.text(ctx, move.keyCap, x + 16, y - 2, { color: HUD_COLORS.muted });
                x += isChord ? chordStep : step;
            });
        });
    }

    renderSpares(ctx, spares, x) {
        const sprite = Sprites.dome('buddy', 'blue');
        for (let i = 0; i < Math.min(spares, 8); i++) ctx.drawImage(sprite, x + i * 12, 7);
    }

    renderBossBar(ctx, boss) {
        const game = this.game;
        const width = Math.min(260, game.viewW - 40);
        const left = Math.round((game.viewW - width) / 2);
        const top = 34;
        ctx.fillStyle = OUTLINE_COLOR;
        ctx.fillRect(left - 2, top - 2, width + 4, 10);
        ctx.fillStyle = HUD_COLORS.empty;
        ctx.fillRect(left, top, width, 6);
        const fraction = Math.max(0, boss.health / boss.maxHealth);
        ctx.fillStyle = '#ec4d6e';
        ctx.fillRect(left, top, Math.ceil(width * fraction), 6);
        ctx.fillStyle = '#ffb0b8';
        ctx.fillRect(left, top, Math.ceil(width * fraction), 2);
        // Notches at the phase changes
        ctx.fillStyle = OUTLINE_COLOR;
        boss.def.phases.slice(1).forEach(phase => ctx.fillRect(left + Math.round(width * phase.below), top, 1, 6));
        Sprites.text(ctx, boss.def.name, game.viewW / 2, top + 7, { align: 'center', shadow: OUTLINE_COLOR });
    }

    /**
     * Beats slide in from both sides and meet in the middle on the beat
     */
    renderBeatBar(ctx) {
        const game = this.game;
        const width = 150;
        const left = Math.round((game.viewW - width) / 2);
        const y = game.viewH - 12;
        const centre = left + width / 2;

        ctx.fillStyle = HUD_COLORS.panel;
        ctx.fillRect(0, game.viewH - HUD_BOTTOM_PX, game.viewW, HUD_BOTTOM_PX);
        ctx.fillStyle = HUD_COLORS.panelEdge;
        ctx.fillRect(0, game.viewH - HUD_BOTTOM_PX, game.viewW, 1);
        this.renderChordBar(ctx);
        if (game.beatless) return; // Recordings have no beat to show

        const position = game.heardBeat();
        const fraction = position - Math.floor(position);
        for (let i = 0; i < 3; i++) {
            const distance = (1 - fraction + i) * 24;
            const color = i === 0 ? '#f2e8d2' : '#6d6488';
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(centre - distance) - 1, y + 2, 2, 7);
            ctx.fillRect(Math.round(centre + distance) - 1, y + 2, 2, 7);
        }

        const onBeat = game.isOnBeat();
        ctx.fillStyle = onBeat ? '#ffd45e' : '#3d3550';
        ctx.fillRect(centre - 3, y + 1, 6, 9);
        ctx.fillStyle = onBeat ? '#ffffff' : '#6d6488';
        ctx.fillRect(centre - 1, y + 1, 2, 9);

        // A shot on the beat lights the bar, and that is all the fuss it needs
        if (game.clock < game.beatHitUntil) {
            ctx.fillStyle = '#ffd45e';
            ctx.fillRect(centre - 26, y + 5, 20, 1);
            ctx.fillRect(centre + 6, y + 5, 20, 1);
        }
    }

    renderDoorHint(ctx, door) {
        const game = this.game;
        const y = game.viewH - 40;
        const held = game.harmony[0] ? game.harmony[0].melody : [];
        const tail = held.slice(-door.melody.length);
        Sprites.text(ctx, door.hint, game.viewW / 2, y - 13, { align: 'center', color: '#ffd45e', shadow: OUTLINE_COLOR });

        const size = 15;
        const startX = Math.round(game.viewW / 2 - door.melody.length * (size + 2) / 2);
        // How much of the tune has been played so far
        let matched = 0;
        for (let n = Math.min(tail.length, door.melody.length); n > 0; n--) {
            if (tail.slice(-n).every((key, i) => key === door.melody[i])) {
                matched = n;
                break;
            }
        }
        door.melody.forEach((key, i) => {
            const x = startX + i * (size + 2);
            ctx.fillStyle = OUTLINE_COLOR;
            ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
            ctx.fillStyle = i < matched ? '#ffd45e' : '#f2e8d2';
            ctx.fillRect(x, y, size, size);
            Sprites.text(ctx, Prompts.harmonyKey(key), x + size / 2, y + 1, { align: 'center', color: OUTLINE_COLOR });
        });
    }

    renderBanner(ctx) {
        const game = this.game;
        const banner = game.banner;
        if (!banner || game.dialog) return;
        const y = Math.round(game.viewH * 0.3);
        ctx.fillStyle = 'rgba(27, 24, 48, 0.86)';
        ctx.fillRect(0, y, game.viewW, banner.subtitle ? 40 : 26);
        ctx.fillStyle = '#ffd45e';
        ctx.fillRect(0, y, game.viewW, 1);
        ctx.fillRect(0, y + (banner.subtitle ? 39 : 25), game.viewW, 1);
        Sprites.text(ctx, banner.title, game.viewW / 2, y + 2, { size: 20, align: 'center', color: '#ffffff', shadow: OUTLINE_COLOR });
        if (banner.subtitle) {
            Sprites.text(ctx, banner.subtitle, game.viewW / 2, y + 25, { align: 'center', color: '#ffd45e' });
        }
    }

    renderDialog(ctx) {
        const game = this.game;
        const dialog = game.dialog;
        const line = dialog.line;
        if (!line) return;
        const speaker = CHARACTERS[line.who] || CHARACTERS.pip;
        const height = 62;
        const top = game.viewH - height;

        // A curtain over the stage, and a box running the full width of the window
        ctx.fillStyle = 'rgba(15, 11, 24, 0.35)';
        ctx.fillRect(0, 0, game.viewW, top);
        ctx.fillStyle = HUD_COLORS.panel;
        ctx.fillRect(0, top, game.viewW, height);
        ctx.fillStyle = '#ffd45e';
        ctx.fillRect(0, top, game.viewW, 1);

        ctx.fillStyle = '#2a2640';
        ctx.fillRect(0, top + 1, 46, height - 1);
        ctx.drawImage(portraitSprite(speaker.portrait), 7, top + 14);

        Sprites.text(ctx, speaker.name, 54, top, { color: '#ffd45e' });

        const shown = line.text.slice(0, Math.floor(dialog.shown));
        const maxWidth = Math.min(game.viewW - 66, 400);
        // Lines wrap on the full text, so that words do not jump as they type out
        let drawn = 0;
        const rows = Sprites.wrapText(line.text, maxWidth).slice(0, line.hint ? 3 : 4);
        rows.forEach((row, i) => {
            const visible = shown.slice(drawn, drawn + row.length);
            Sprites.text(ctx, visible, 54, top + 12 + i * 11, { color: HUD_COLORS.text });
            drawn += row.length + 1;
        });
        if (line.hint && dialog.finishedTyping) {
            Sprites.text(ctx, line.hint, 54, top + 47, { color: '#ffd45e' });
        }

        if (dialog.finishedTyping && Math.floor(game.clock / 400 + performance.now() / 400) % 2) {
            ctx.fillStyle = '#ffd45e';
            ctx.fillRect(game.viewW - 12, game.viewH - 8, 7, 2);
            ctx.fillRect(game.viewW - 11, game.viewH - 6, 5, 2);
            ctx.fillRect(game.viewW - 10, game.viewH - 4, 3, 2);
        }
    }

    renderFlash(ctx) {
        const game = this.game;
        const remaining = (game.flashUntil - game.clock) / (game.flashLength || 1);
        ctx.globalAlpha = Math.min(0.75, remaining);
        ctx.fillStyle = game.flashColor;
        ctx.fillRect(0, 0, game.viewW, game.viewH);
        ctx.globalAlpha = 1;
    }
}

window.GameRenderer = GameRenderer;
