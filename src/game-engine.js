
export class GameEngine {
    constructor() {
        this.GRID_W = 200;
        this.GRID_H = 300;
        this.MARGIN = 20;
        this.TIME_PER_HALF = 120;
        
        this.reset();
    }

    reset() {
        this.ball = {
            x: 0,
            z: 0,
            y: 3,
            isMoving: false,
            startX: 0,
            startZ: 0,
            targetX: 0,
            targetZ: 0,
            progress: 0,
            speed: 0,
            arcHeight: 0
        };

        this.players = [
            { id: 1, team: 'A', role: 'GK', x: 0, z: -140, name: "Brasil GK", number: 1, message: "", messageTimeout: 0, cooldown: 0 },
            { id: 2, team: 'A', role: 'FIELD', x: -30, z: -80, name: "Brasil 2", number: 2, message: "", messageTimeout: 0, cooldown: 0 },
            { id: 3, team: 'A', role: 'FIELD', x: 30, z: -80, name: "Brasil 3", number: 3, message: "", messageTimeout: 0, cooldown: 0 },
            { id: 4, team: 'A', role: 'FIELD', x: -50, z: -20, name: "Brasil 4", number: 4, message: "", messageTimeout: 0, cooldown: 0 },
            { id: 5, team: 'A', role: 'FIELD', x: 50, z: -20, name: "Brasil 5", number: 5, message: "", messageTimeout: 0, cooldown: 0 },
            { id: 6, team: 'B', role: 'GK', x: 0, z: 140, name: "Argentina GK", number: 1, message: "", messageTimeout: 0, cooldown: 0 },
            { id: 7, team: 'B', role: 'FIELD', x: -30, z: 80, name: "Argentina 7", number: 7, message: "", messageTimeout: 0, cooldown: 0 },
            { id: 8, team: 'B', role: 'FIELD', x: 30, z: 80, name: "Argentina 8", number: 8, message: "", messageTimeout: 0, cooldown: 0 },
            { id: 9, team: 'B', role: 'FIELD', x: -50, z: 20, name: "Argentina 9", number: 9, message: "", messageTimeout: 0, cooldown: 0 },
            { id: 10, team: 'B', role: 'FIELD', x: 50, z: 20, name: "Argentina 10", number: 10, message: "", messageTimeout: 0, cooldown: 0 }
        ];

        this.score = { A: 0, B: 0 };
        this.gameTime = this.TIME_PER_HALF;
        this.currentHalf = 1;
        this.isGameActive = false;
        this.isGoal = false;
        this.lastUpdate = Date.now();
    }

    update(dt) {
        if (this.isGameActive && !this.isGoal) {
            this.gameTime -= dt;
            if (this.gameTime <= 0) {
                this.isGameActive = false;
            }
            this.updateIA(dt);
        }

        this.updateBall(dt);
        this.updatePlayers(dt);
        this.checkCollisions();
        this.checkGoal();

        // Se a bola não estiver se movendo, garantir que Y seja 3 (chão)
        if (!this.ball.isMoving) {
            this.ball.y = 3;
        }

        return this.getState();
    }

    updateIA(dt) {
        this.players.forEach(p => {
            if (p.isControlled) return;

            if (p.cooldown > 0) return;
            p.cooldown = 0.5;

            // Distância para a bola (em unidades de 10)
            const gridBallX = Math.round(this.ball.x / 10) * 10;
            const gridBallZ = Math.round(this.ball.z / 10) * 10;
            const distToBall = Math.abs(p.x - gridBallX) + Math.abs(p.z - gridBallZ);

            if (p.role === 'GK') {
                let targetX = Math.max(-30, Math.min(30, gridBallX));
                let dx = Math.sign(targetX - p.x) * 10; // Passo de 10
                if (dx !== 0) this.movePlayer(p, dx, 0);
                return;
            }

            if (distToBall <= 10 && !this.ball.isMoving) {
                const targetGoalZ = p.team === 'A' ? 150 : -150;
                const dirZ = Math.sign(targetGoalZ - p.z);
                const dirX = Math.sign(0 - p.x); 
                
                this.handleAction(p.id, { type: 'kick', power: 1, dirX, dirZ });
                return;
            }

            // Lógica de quem persegue a bola
            let myTeam = this.players.filter(pl => pl.team === p.team && pl.role === 'FIELD');
            let isClosest = true;
            for (let t of myTeam) {
                if (t === p) continue;
                let tDist = Math.abs(t.x - gridBallX) + Math.abs(t.z - gridBallZ);
                if (tDist < distToBall) isClosest = false;
            }

            if (isClosest && !this.ball.isMoving) {
                let dx = Math.sign(gridBallX - p.x) * 10;
                let dz = Math.sign(gridBallZ - p.z) * 10;
                
                if (Math.abs(gridBallX - p.x) > Math.abs(gridBallZ - p.z)) {
                    if (dx !== 0 && this.movePlayer(p, dx, 0)) return;
                    if (dz !== 0) this.movePlayer(p, 0, dz);
                } else {
                    if (dz !== 0 && this.movePlayer(p, 0, dz)) return;
                    if (dx !== 0) this.movePlayer(p, dx, 0);
                }
            } else {
                let baseZ = p.team === 'A' ? -60 : 60;
                let dz = Math.sign(baseZ - p.z) * 10;
                if (dz !== 0 && Math.random() > 0.5) this.movePlayer(p, 0, dz);
            }
        });
    }

    movePlayer(p, dx, dz) {
        const newX = p.x + dx;
        const newZ = p.z + dz;

        // Limites gerais do campo (x10)
        if (newX < -120 || newX > 120 || newZ < -170 || newZ > 170) return false;

        // Limites específicos do Goleiro (Área Grande x10)
        if (p.role === 'GK') {
            if (newX < -40 || newX > 40) return false;
            if (p.team === 'A' && newZ > -120) return false; 
            if (p.team === 'B' && newZ < 120) return false;  
        }
        
        // Impedir que dois jogadores fiquem na mesma casa
        if (this.players.some(other => other.id !== p.id && other.x === newX && other.z === newZ)) return false;

        // LÓGICA DE CONDUZIR/EMPURRAR A BOLA
        const ballGridX = Math.round(this.ball.x / 10) * 10;
        const ballGridZ = Math.round(this.ball.z / 10) * 10;

        if (newX === ballGridX && newZ === ballGridZ && !this.ball.isMoving) {
            let ballNextX = newX + dx;
            let ballNextZ = newZ + dz;
            
            const isBallPathBlocked = this.players.some(other => other.x === ballNextX && other.z === ballNextZ);
            const isBallOutOfBounds = ballNextX < -120 || ballNextX > 120 || ballNextZ < -170 || ballNextZ > 170;

            if (isBallPathBlocked || isBallOutOfBounds) {
                return false; 
            }

            this.ball.x = ballNextX;
            this.ball.z = ballNextZ;
            this.ball.y = 3; 
        }

        p.x = newX;
        p.z = newZ;
        return true;
    }

    updateBall(dt) {
        if (!this.ball.isMoving) return;

        this.ball.progress += dt * this.ball.speed;
        if (this.ball.progress >= 1) {
            this.ball.progress = 1;
            this.ball.isMoving = false;
            this.ball.x = Math.round(this.ball.targetX / 10) * 10;
            this.ball.z = Math.round(this.ball.targetZ / 10) * 10;
            this.ball.y = 3;
        } else {
            this.ball.x = this.ball.startX + (this.ball.targetX - this.ball.startX) * this.ball.progress;
            this.ball.z = this.ball.startZ + (this.ball.targetZ - this.ball.startZ) * this.ball.progress;
            this.ball.y = 3 + Math.sin(this.ball.progress * Math.PI) * this.ball.arcHeight;
        }

        // Limites do campo (Out of bounds x10)
        if (this.ball.x < -120 || this.ball.x > 120 || this.ball.z < -170 || this.ball.z > 170) {
            this.ball.isMoving = false;
            this.ball.x = Math.max(-120, Math.min(120, Math.round(this.ball.x / 10) * 10));
            this.ball.z = Math.max(-170, Math.min(170, Math.round(this.ball.z / 10) * 10));
            this.ball.y = 3;
        }
    }

    checkCollisions() {
        if (!this.ball.isMoving) return;
        
        const currentGridX = Math.round(this.ball.x / 10) * 10;
        const currentGridZ = Math.round(this.ball.z / 10) * 10;
        const startGridX = Math.round(this.ball.startX / 10) * 10;
        const startGridZ = Math.round(this.ball.startZ / 10) * 10;

        if (currentGridX !== startGridX || currentGridZ !== startGridZ) {
            const hitPlayer = this.players.find(p => p.x === currentGridX && p.z === currentGridZ);
            
            if (hitPlayer) {
                if (hitPlayer.role === 'GK' && this.ball.y < 30.0) {
                    this.ball.isMoving = false;
                    this.ball.x = hitPlayer.x;
                    this.ball.z = hitPlayer.z > 0 ? hitPlayer.z - 10 : hitPlayer.z + 10; 
                    this.ball.y = 3;
                } 
                else if (this.ball.y < 20.0) {
                    this.ball.isMoving = false;
                    this.ball.x = hitPlayer.x; 
                    this.ball.z = hitPlayer.z;
                    this.ball.y = 3;
                }
            }
        }
    }

    updatePlayers(dt) {
        this.players.forEach(p => {
            if (p.cooldown > 0) p.cooldown -= dt;
            if (p.messageTimeout > 0) {
                p.messageTimeout -= dt;
                if (p.messageTimeout <= 0) p.message = "";
            }
        });
    }

    checkGoal() {
        if (this.isGoal) return;
        
        const bx = Math.round(this.ball.x / 10) * 10;
        const bz = Math.round(this.ball.z / 10) * 10;

        // GOL (x10)
        if (bz >= 160 && bx >= -30 && bx <= 30) {
            this.score.A++;
            this.triggerGoal();
        } else if (bz <= -160 && bx >= -30 && bx <= 30) {
            this.score.B++;
            this.triggerGoal();
        } 
        // SAÍDA DE BOLA (Reset sem pontuar x10)
        else if (bz < -150 || bz > 150 || bx < -100 || bx > 100) {
            this.triggerGoal();
        }
    }

    triggerGoal() {
        this.isGoal = true;
        setTimeout(() => {
            this.resetPositions();
            this.isGoal = false;
        }, 3000);
    }

    resetPositions() {
        this.ball.x = 0;
        this.ball.z = 0;
        this.ball.isMoving = false;
        this.ball.progress = 0;
        
        const starts = [
            { id: 1, x: 0, z: -140 }, { id: 2, x: -30, z: -80 }, { id: 3, x: 30, z: -80 }, { id: 4, x: -50, z: -20 }, { id: 5, x: 50, z: -20 },
            { id: 6, x: 0, z: 140 }, { id: 7, x: -30, z: 80 }, { id: 8, x: 30, z: 80 }, { id: 9, x: -50, z: 20 }, { id: 10, x: 50, z: 20 }
        ];

        starts.forEach(s => {
            const p = this.players.find(pl => pl.id === s.id);
            if (p) { p.x = s.x; p.z = s.z; p.cooldown = 0; }
        });
    }

    handleAction(playerId, action) {
        const p = this.players.find(pl => pl.id === playerId);
        if (!p) return;

        if (action.isManual) {
            p.isControlled = true;
            if (p.controlTimeout) clearTimeout(p.controlTimeout);
            p.controlTimeout = setTimeout(() => { p.isControlled = false; }, 5000); 
        }

        if (action.type === 'move') {
            this.movePlayer(p, (action.dx || 0) * 10, (action.dz || 0) * 10);
        } 
        else if (action.type === 'kick') {
            const gridBallX = Math.round(this.ball.x / 10) * 10;
            const gridBallZ = Math.round(this.ball.z / 10) * 10;
            const dist = Math.abs(p.x - gridBallX) + Math.abs(p.z - gridBallZ);

            if (dist <= 10 && !this.ball.isMoving) {
                this.ball.isMoving = true;
                this.ball.startX = this.ball.x;
                this.ball.startZ = this.ball.z;
                this.ball.progress = 0;
                
                const power = action.power || 1;
                const dirX = action.dirX || 0;
                const dirZ = action.dirZ || (p.team === 'A' ? 1 : -1);

                let distance = 0;
                if (power === 1) { distance = 120; this.ball.speed = 3.0; this.ball.arcHeight = 2.0; }
                else if (power === 2) { distance = 80; this.ball.speed = 2.0; this.ball.arcHeight = 25.0; }
                else if (power === 3) { distance = 50; this.ball.speed = 1.0; this.ball.arcHeight = 50.0; }

                this.ball.targetX = this.ball.x + (dirX * distance);
                this.ball.targetZ = this.ball.z + (dirZ * distance);
            }
        }
        else if (action.type === 'config') {
            if (action.name) p.name = action.name.substring(0, 50);
            if (action.number !== undefined) p.number = parseInt(action.number);
        }
        else if (action.type === 'speak') {
            p.message = action.text.substring(0, 100);
            p.messageTimeout = 3.0;
        }
    }

    getState() {
        return {
            fieldSize: { width: this.GRID_W + this.MARGIN*2, height: this.GRID_H + this.MARGIN*2 },
            ball: { x: this.ball.x, y: this.ball.y, z: this.ball.z, isMoving: this.ball.isMoving },
            players: this.players.map(p => ({
                id: p.id, team: p.team, role: p.role, x: p.x, z: p.z, name: p.name, number: p.number, message: p.message
            })),
            score: this.score,
            gameTime: this.gameTime,
            isGoal: this.isGoal
        };
    }
}
