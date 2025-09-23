// =============================================================================
// GAME RENDERER MODULE
// =============================================================================

class GameRenderer {
    constructor(game) {
        this.game = game;
    }

    render() {
        const { ctx, canvas } = this.game;
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = GAME_CONFIG.MAP_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply camera transformation for campaign mode
        if (this.game.gameMode === GAME_MODES.CAMPAIGN && this.game.camera) {
            ctx.save();
            ctx.translate(-this.game.camera.x, -this.game.camera.y);
        }

        this.renderGrid();
        this.renderObstacles();
        this.renderTanks();
        this.renderCampaignEnemies();
        this.renderBullets();
        this.renderPowerups();
        
        // Restore camera transformation
        if (this.game.gameMode === GAME_MODES.CAMPAIGN && this.game.camera) {
            ctx.restore();
        }
        
        this.renderUI();
    }

    renderGrid() {
        const { ctx, canvas } = this.game;
        const gridSize = 50;
        const gridColor = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        
        // Use full map size in campaign (camera is already translated), otherwise canvas size
        const width = (this.game.gameMode === GAME_MODES.CAMPAIGN) ? GAME_CONFIG.MAP_WIDTH : canvas.width;
        const height = (this.game.gameMode === GAME_MODES.CAMPAIGN) ? GAME_CONFIG.MAP_HEIGHT : canvas.height;
        
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    renderObstacles() {
        const { ctx } = this.game;
        this.game.obstacles.forEach(obstacle => {
            ctx.fillStyle = obstacle.color;
            if (obstacle.type === 'rock') {
                ctx.beginPath();
                ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(
                    obstacle.x - obstacle.width / 2,
                    obstacle.y - obstacle.height / 2,
                    obstacle.width,
                    obstacle.height
                );
            }
        });
    }

    renderTanks() {
        const { ctx } = this.game;
        this.game.tanks.forEach(tank => {
            if (!tank.isAlive) return;
            ctx.save();
            ctx.translate(tank.x, tank.y);
            ctx.fillStyle = tank.color;
            ctx.beginPath();
            ctx.arc(0, 0, tank.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#808080';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(tank.turretAngle) * tank.turretLength, Math.sin(tank.turretAngle) * tank.turretLength);
            ctx.stroke();
            if (tank.health < tank.maxHealth) {
                const barWidth = tank.size;
                const barHeight = 4;
                const healthPercent = tank.health / tank.maxHealth;
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(-barWidth / 2, -tank.size / 2 - 10, barWidth, barHeight);
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(-barWidth / 2, -tank.size / 2 - 10, barWidth * healthPercent, barHeight);
            }
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const nameY = -tank.size / 2 - 15;
            ctx.strokeText(tank.name, 0, nameY);
            ctx.fillText(tank.name, 0, nameY);
            this.renderPowerupIndicators(tank, nameY);
            ctx.restore();
        });
    }

    renderBullets() {
        const { ctx } = this.game;
        this.game.bullets.forEach(bullet => {
            ctx.fillStyle = bullet.color;
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.size / 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    renderPowerupIndicators(tank, nameY) {
        const { ctx } = this.game;
        const activePowerups = [];
        const powerupMapping = {
            'invincibility': 'INVINCIBILITY',
            'speed': 'SPEED',
            'rapidFire': 'RAPID_FIRE',
            'spreadShot': 'SPREAD_SHOT',
            'bouncingBullets': 'BOUNCING_BULLETS'
        };
        Object.keys(tank.powerups).forEach(powerupType => {
            const powerupArray = tank.powerups[powerupType];
            if (powerupArray.length > 0) {
                const configKey = powerupMapping[powerupType];
                if (configKey && GAME_CONFIG.POWERUP_TYPES[configKey]) {
                    const maxTimeRemaining = Math.max(...powerupArray);
                    activePowerups.push({
                        type: configKey,
                        timeRemaining: maxTimeRemaining,
                        stacks: powerupArray.length
                    });
                }
            }
        });
        if (activePowerups.length === 0) return;
        const nameWidth = ctx.measureText(tank.name).width;
        const startX = nameWidth / 2 + 10;
        const indicatorY = nameY - 5;
        activePowerups.forEach((powerup, index) => {
            const indicatorX = startX + (index * 25);
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            const emoji = GAME_CONFIG.POWERUP_TYPES[powerup.type].emoji;
            ctx.strokeText(emoji, indicatorX, indicatorY);
            ctx.fillText(emoji, indicatorX, indicatorY);
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#ffff00';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            const timeText = Math.ceil(powerup.timeRemaining / 1000) + 's';
            const stackText = powerup.stacks > 1 ? ` (${powerup.stacks}x)` : '';
            ctx.strokeText(timeText + stackText, indicatorX, indicatorY + 8);
            ctx.fillText(timeText + stackText, indicatorX, indicatorY + 8);
        });
    }

    renderPowerups() {
        const { ctx } = this.game;
        this.game.powerups.forEach(powerup => {
            if (!powerup.alive) return;
            ctx.save();
            ctx.translate(powerup.x, powerup.y);
            ctx.rotate(powerup.rotation);
            ctx.fillStyle = GAME_CONFIG.POWERUP_TYPES[powerup.type].color;
            ctx.beginPath();
            ctx.arc(0, 0, powerup.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(GAME_CONFIG.POWERUP_TYPES[powerup.type].emoji, 0, 0);
            ctx.restore();
            powerup.rotation += 0.02;
        });
    }

    renderUI() {
        const { ctx, canvas } = this.game;
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        const padding = 10;
        const lineHeight = 20;
        const x = canvas.width - padding;

        let lines = [];
        let colors = [];
        
        if (this.game.gameMode === GAME_MODES.TDM) {
            const redAlive = this.game.teams.red.filter(tank => tank.isAlive).length;
            const blueAlive = this.game.teams.blue.filter(tank => tank.isAlive).length;
            lines = [`Red Team: ${redAlive}`, `Blue Team: ${blueAlive}`, 'Mode: TDM'];
            colors = [GAME_CONFIG.TEAM_COLORS.RED, GAME_CONFIG.TEAM_COLORS.BLUE, '#ffffff'];
        } else if (this.game.gameMode === GAME_MODES.CAMPAIGN) {
            if (this.game.mode && this.game.mode.hudInfo) {
                const hudInfo = this.game.mode.hudInfo(this.game);
                lines = hudInfo.lines || [];
            }
            colors = lines.map(() => '#ffffff');
        } else {
            const aliveTanks = this.game.tanks.filter(tank => tank.isAlive).length;
            lines = [
                `Players: ${this.game.numPlayers} | AI: ${this.game.numAIBots}`,
                `Alive: ${aliveTanks}`,
                'Mode: FFA'
            ];
            colors = ['#ffffff', '#ffffff', '#ffffff'];
        }

        const startY = canvas.height - padding - (lines.length > 0 ? (lines.length - 1) * lineHeight : 0);
        lines.forEach((line, index) => {
            ctx.fillStyle = colors[index] || '#ffffff';
            ctx.fillText(line, x, startY + index * lineHeight);
        });
    }
    
    renderCampaignEnemies() {
        if (this.game.gameMode !== GAME_MODES.CAMPAIGN || !this.game.mode) return;
        
        const { ctx } = this.game;
        this.game.mode.enemies.forEach(enemy => {
            if (!enemy.isAlive) return;
            
            ctx.save();
            ctx.translate(enemy.x, enemy.y);
            
            // Draw enemy body
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(0, 0, enemy.size / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Remove black outline for cleaner look
            
            // Draw turret for all enemies, gray color
            ctx.strokeStyle = '#808080';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(enemy.angle) * (enemy.size / 2 + 10), Math.sin(enemy.angle) * (enemy.size / 2 + 10));
            ctx.stroke();
            
            // Draw health bar (always show for enemies)
            const barWidth = enemy.size;
            const barHeight = 4;
            const healthPercent = enemy.health / enemy.maxHealth;
            
            // Background
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-barWidth / 2, -enemy.size / 2 - 10, barWidth, barHeight);
            
            // Health
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(-barWidth / 2, -enemy.size / 2 - 10, barWidth * healthPercent, barHeight);
            
            // No border for healthbar (remove black outline)
            
            // Special effects for boss
            if (enemy.type === 'boss' && enemy.isEnraged) {
                // Pulsing effect
                const pulse = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
                ctx.globalAlpha = pulse;
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, enemy.size / 2 + 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            
            ctx.restore();
        });
    }
}

window.GameRenderer = GameRenderer;


