
export class GameEngine {
    constructor(options = {}) {
        this.mode = options.mode || 'play';
        this.autoGk = options.autoGk !== false;
        this.autoOpponent = options.autoOpponent !== false;
        this.ballBounce = options.ballBounce !== false;

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
            speed: 2.0, // Updated speed as per instruction snippet
            arcHeight: 0,
            lastKickerId: null // Added lastKickerId
        };

        if (this.mode === 'play') {
            this.players = [];
            const starts = [
                { x: 0, z: 140 }, // GK A (Brasil)
                { x: -30, z: 80 }, // FIELD A
                { x: 30, z: 80 }, // FIELD A
                { x: -50, z: 20 }, // FIELD A
                { x: 50, z: 20 }, // FIELD A
                { x: 0, z: -140 }, // GK B (Argentina)
                { x: -30, z: -80 }, // FIELD B
                { x: 30, z: -80 }, // FIELD B
                { x: -50, z: -20 }, // FIELD B
                { x: 50, z: -20 }  // FIELD B
            ];

            starts.slice(0, 5).forEach((start, i) => {
                const teamAPlayer = { id: i + 1, team: 'A', role: i === 0 ? 'GK' : 'FIELD', x: start.x, z: start.z, name: `Brasil ${i === 0 ? 'GK' : i + 1}`, number: i + 1, message: "", messageTimeout: 0, cooldown: 0 };
                teamAPlayer.facingX = 0;
                teamAPlayer.facingZ = -1; // Time A (Brasil) olha para Argentina (Negativo)
                this.players.push(teamAPlayer);
            });
            starts.slice(5).forEach((start, i) => {
                const teamBPlayer = { id: i + 6, team: 'B', role: i === 0 ? 'GK' : 'FIELD', x: start.x, z: start.z, name: `Argentina ${i === 0 ? 'GK' : i + 6}`, number: i + 1, message: "", messageTimeout: 0, cooldown: 0 };
                teamBPlayer.facingX = 0;
                teamBPlayer.facingZ = 1; // Time B (Argentina) olha para Brasil (Positivo)
                this.players.push(teamBPlayer);
            });
            this.gameTime = this.TIME_PER_HALF;
            this.currentHalf = 1;

        } else if (this.mode === 'train') {
            this.players = [
                { id: 1, team: 'A', role: 'FIELD', x: 0, z: 140, name: "Treinador", number: 10, message: "", messageTimeout: 0, cooldown: 0, facingX: 0, facingZ: -1 }
            ];
            
            this.players.push({ id: 6, team: 'B', role: 'GK', x: 0, z: -140, name: "Goleiro", number: 1, message: "", messageTimeout: 0, cooldown: 0, facingX: 0, facingZ: 1 });
            
            this.gameTime = 9999; 
            this.currentHalf = 1;
        } else if (this.mode === '1v1') {
            this.players = [
                { id: 1, team: 'A', role: 'FIELD', x: 0, z: 100, name: "Jogador 1", number: 10, message: "", messageTimeout: 0, cooldown: 0, facingX: 0, facingZ: -1 },
                { id: 6, team: 'B', role: 'FIELD', x: 0, z: -100, name: "Jogador 2", number: 7, message: "", messageTimeout: 0, cooldown: 0, facingX: 0, facingZ: 1 }
            ];

            const randomX = (Math.floor(Math.random() * 13) - 6) * 10; // -60 a 60
            const randomZ = (Math.floor(Math.random() * 11) - 5) * 10; // -50 a 50 (centro do campo)
            this.ball.x = randomX;
            this.ball.z = randomZ;

            this.gameTime = 9999;
            this.currentHalf = 1;
        }

        this.score = { A: 0, B: 0 };
        this.isGameActive = false; 
        if(this.mode === 'train' || this.mode === '1v1') this.isGameActive = true; 
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

            if (this.mode === 'train' && p.role === 'FIELD') return;
            // No modo 1v1, o Jogador 1 (Brasil) é manual se houver alguém controlando ou se for o padrão.
            // O Jogador 2 (Argentina) é manual se 'autoOpponent' for falso OU se houver controle manual ativo.
            if (this.mode === '1v1') {
                if (p.id === 1) return; // Brasil sempre manual no 1v1 (Player 1)
                if (p.id === 6 && (!this.autoOpponent || p.isControlled)) return; // Argentina manual se IA off ou se alguém assumir
            }

            if (p.cooldown > 0) return;
            p.cooldown = 0.5;

            // Distância para a bola (em unidades de 10)
            const gridBallX = Math.round(this.ball.x / 10) * 10;
            const gridBallZ = Math.round(this.ball.z / 10) * 10;
            const distToBall = Math.abs(p.x - gridBallX) + Math.abs(p.z - gridBallZ);

            if (p.role === 'GK') {
                if (this.mode === 'train' && !this.autoGk) return; // Se for treino e autoGk falso, goleiro fica parado

                let targetX = Math.max(-30, Math.min(30, gridBallX));
                let dx = Math.sign(targetX - p.x) * 10; 
                if (dx !== 0) this.movePlayer(p, dx, 0);
                
                // Após mover (ou se já estiver no lugar), verifica se pode chutar
                const currentDist = Math.max(Math.abs(p.x - gridBallX), Math.abs(p.z - gridBallZ));
                if (currentDist <= 10 && !this.ball.isMoving) {
                    // GK sempre chuta para longe do próprio gol (em direção ao centro do campo)
                    const dirZ = Math.sign(0 - p.z) || 1;
                    const dirX = Math.sign(0 - p.x); 
                    
                    p.facingX = dirX;
                    p.facingZ = dirZ;

                    const kickPower = (this.mode === 'train') ? 3 : 1;
                    this.handleAction(p.id, { type: 'kick', power: kickPower, dirX, dirZ });
                }
                return;
            }

            if (distToBall <= 10 && !this.ball.isMoving) {
                const targetGoalZ = p.team === 'A' ? -150 : 150;
                const distToGoal = Math.abs(targetGoalZ - p.z);
                
                let power = 1;
                if (this.mode === '1v1') {
                    if (distToGoal > 120) power = 2;
                    if (distToGoal > 200) power = 3;
                }

                const dirZ = Math.sign(targetGoalZ - p.z);
                const dirX = Math.sign(0 - p.x); 
                this.handleAction(p.id, { type: 'kick', power: power, dirX, dirZ });
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
                
                // Se estiver em cima da bola, anda em direção ao gol (conduzindo)
                if (dx === 0 && dz === 0) {
                    const targetGoalZ = p.team === 'A' ? -150 : 150;
                    dz = Math.sign(targetGoalZ - p.z) * 10;
                    dx = Math.sign(0 - p.x) * 10;
                }

                if (Math.abs(gridBallX - p.x) > Math.abs(gridBallZ - p.z) || (dx !== 0 && dz === 0)) {
                    if (dx !== 0 && this.movePlayer(p, dx, 0)) return;
                    if (dz !== 0) this.movePlayer(p, 0, dz);
                } else {
                    if (dz !== 0 && this.movePlayer(p, 0, dz)) return;
                    if (dx !== 0) this.movePlayer(p, dx, 0);
                }
            } else {
                // REPOSICIONAMENTO MAIS INTELIGENTE:
                // Só volta para a base se a bola estiver longe (> 80 unidades) 
                // OU se a bola estiver vindo para o seu campo.
                const isBallSafe = (p.team === 'A' && gridBallZ < p.z) || (p.team === 'B' && gridBallZ > p.z);
                if (distToBall > 80 || !isBallSafe) {
                    let baseZ = p.team === 'A' ? 60 : -60;
                    let baseX = (p.id % 2 === 0) ? -30 : 30; // Distribuição lateral simples
                    
                    let dx = Math.sign(baseX - p.x) * 10;
                    let dz = Math.sign(baseZ - p.z) * 10;
                    
                    if (dz !== 0 && Math.random() > 0.6) this.movePlayer(p, 0, dz);
                    else if (dx !== 0 && Math.random() > 0.6) this.movePlayer(p, dx, 0);
                }
            }
        });
    }

    movePlayer(p, dx, dz) {
        const newX = p.x + dx;
        const newZ = p.z + dz;

        // Limites específicos do Goleiro (Área Grande x10)
        if (p.role === 'GK') {
            if (newX < -40 || newX > 40) return false;
            
            if (this.mode === 'train') {
                if (p.team === 'A' && newZ < 120) return false; 
                if (p.team === 'B' && newZ > -120) return false;  
            } else {
                if (p.team === 'A' && newZ > -120) return false; 
                if (p.team === 'B' && newZ < 120) return false;  
            }
        } else {
            // Limites GERAIS para jogadores de linha (Permitido sair 2 quadrados = 20 unidades)
            if (newX < -120 || newX > 120) return false;
            // Permitir profundidade extra no gol (rede) ate 165 + 5 de margem
            const isGoalWidth = newX >= -30 && newX <= 30;
            const limitZ = isGoalWidth ? 175 : 170;
            if (Math.abs(newZ) > limitZ) return false;
        }
        
        // Impedir que dois jogadores fiquem na mesma casa
        if (this.players.some(other => other.id !== p.id && other.x === newX && other.z === newZ)) return false;

        // LÓGICA DE CONDUZIR/EMPURRAR A BOLA
        const ballGridX = Math.round(this.ball.x / 10) * 10;
        const ballGridZ = Math.round(this.ball.z / 10) * 10;

        // Vetor relativo da bola para o jogador
        const relX = ballGridX - p.x;
        const relZ = ballGridZ - p.z;

        // Se a bola estiver adjacente (em qualquer uma das 8 casas ao redor ou na mesma casa)
        const isBallInReach = Math.abs(relX) <= 10 && Math.abs(relZ) <= 10;
        
        // dot >= 0 significa que o movimento é na mesma direção geral da bola (<= 45 graus)
        // Ou se o jogador estiver EXATAMENTE na mesma casa (relX=0, relZ=0), ele empurra com o movimento.
        const dot = relX * dx + relZ * dz;
        const isSweep = isBallInReach && (dot > 0 || (relX === 0 && relZ === 0)) && !this.ball.isMoving;

        if (isSweep) {
            let ballNextX = newX + dx;
            let ballNextZ = newZ + dz;
            
            const isBallPathBlocked = this.players.some(other => other.x === ballNextX && other.z === ballNextZ);
            
            // Fora de campo: Laterais (+/- 100) e Fundo (+/- 150, a menos que seja no gol)
            // Se for gol, permite ir até 165 para dar profundidade (rede)
            const isGoalWidth = ballNextX >= -30 && ballNextX <= 30;
            const goalLimitZ = isGoalWidth ? 165 : 150;
            const isBallOutOfBounds = Math.abs(ballNextX) > 100 || (Math.abs(ballNextZ) > goalLimitZ && !isGoalWidth);

            if (isBallPathBlocked) return false;

            if (isBallOutOfBounds) {
                // Se a bola for sair pela lateral e o bounce estiver ativo, pipoca ela!
                if (Math.abs(ballNextX) > 100 && this.ballBounce) {
                    this.ball.x = ballNextX; // Temporariamente fora para o trigger detectar o lado
                    this.triggerSideBounce();
                    return true; // Movimento do jogador permitido, bola voou
                }
                return false; 
            }

            this.ball.x = ballNextX;
            this.ball.z = ballNextZ;
            this.ball.y = 3; 
        }

        p.x = newX;
        p.z = newZ;
        
        // Atualizar direção para onde o jogador está olhando (facing)
        // Se houver movimento, guardamos essa direção para o próximo chute
        if (dx !== 0 || dz !== 0) {
            p.facingX = Math.sign(dx);
            p.facingZ = Math.sign(dz);
        }

        return true;
    }

    updateBall(dt) {
        if (!this.ball.isMoving) return;

        // Guardar posição anterior para swept collision
        this.ball.prevX = this.ball.x;
        this.ball.prevZ = this.ball.z;

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

        // FÍSICA DE REBATIDA (Bounce) — pular se já houve gol (celebração)
        if (this.isGoal) return;
        
        // Lateral do campo: +/- 100
        if (this.ball.x > 100 || this.ball.x < -100) {
            if (!this.triggerSideBounce()) {
                // Rebate normal (espelhamento) se bounce estiver off
                if (this.ball.x > 100) {
                    this.ball.x = 200 - this.ball.x;
                    this.ball.targetX = 200 - this.ball.targetX;
                    this.ball.startX = 200 - this.ball.startX;
                } else {
                    this.ball.x = -200 - this.ball.x;
                    this.ball.targetX = -200 - this.ball.targetX;
                    this.ball.startX = -200 - this.ball.startX;
                }
            }
        }

        // Fundo do campo: +/- 150
        // Só rebate se NÃO for gol (o checkGoal cuidará de capturar o gol antes ou depois)
        // Aqui checamos se está fora da largura do gol (30 unidades) ou acima do travessão (25 unidades)
        const isGoalWidth = this.ball.x >= -30 && this.ball.x <= 30;
        const isGoalHeight = this.ball.y < 30; // Travessão generoso

        if (this.ball.z > 150 && !(isGoalWidth && isGoalHeight)) {
            this.ball.z = 300 - this.ball.z;
            this.ball.targetZ = 300 - this.ball.targetZ;
            this.ball.startZ = 300 - this.ball.startZ;
        } else if (this.ball.z < -150 && !(isGoalWidth && isGoalHeight)) {
            this.ball.z = -300 - this.ball.z;
            this.ball.targetZ = -300 - this.ball.targetZ;
            this.ball.startZ = -300 - this.ball.startZ;
        }
    }

    checkCollisions() {
        if (!this.ball.isMoving) return;

        // Swept collision: usa o segmento (posição anterior → posição atual)
        const prevX = this.ball.prevX !== undefined ? this.ball.prevX : this.ball.x;
        const prevZ = this.ball.prevZ !== undefined ? this.ball.prevZ : this.ball.z;
        const currX = this.ball.x;
        const currZ = this.ball.z;

        const segDx = currX - prevX;
        const segDz = currZ - prevZ;
        const segLenSq = segDx * segDx + segDz * segDz;

        if (segLenSq < 0.01) return;

        const COLLISION_RADIUS = 8;

        const hitPlayer = this.players.find(p => {
            if (p.id === this.ball.lastKickerId && this.ball.progress < 0.15) return false;

            const apx = p.x - prevX;
            const apz = p.z - prevZ;
            let t = (apx * segDx + apz * segDz) / segLenSq;
            t = Math.max(0, Math.min(1, t));

            const closestX = prevX + t * segDx;
            const closestZ = prevZ + t * segDz;

            const dx = closestX - p.x;
            const dz = closestZ - p.z;
            const dist = Math.sqrt(dx * dx + dz * dz);


            return dist < COLLISION_RADIUS;
        });

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
        
        const bx = this.ball.x;
        const bz = this.ball.z;
        const by = this.ball.y;

        // Brasil (A) está em +140. Ele faz gol no lado NEGATIVO (-151).
        if (bz <= -151 && bx >= -30 && bx <= 30 && by < 30) {
            this.score.A++; 
            this.triggerGoal();
        } 
        // Argentina (B) está em -140. Ela faz gol no lado POSITIVO (+151).
        else if (bz >= 151 && bx >= -30 && bx <= 30 && by < 30) {
            this.score.B++; 
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
        this.ball.isMoving = false;
        this.ball.progress = 0;
        
        if (this.mode === 'play') {
            this.ball.x = 0;
            this.ball.z = 0;

            const starts = [
                { id: 1, x: 0, z: 140 }, { id: 2, x: -30, z: 80 }, { id: 3, x: 30, z: 80 }, { id: 4, x: -50, z: 20 }, { id: 5, x: 50, z: 20 },
                { id: 6, x: 0, z: -140 }, { id: 7, x: -30, z: -80 }, { id: 8, x: 30, z: -80 }, { id: 9, x: -50, z: -20 }, { id: 10, x: 50, z: -20 }
            ];

            starts.forEach(s => {
                const p = this.players.find(pl => pl.id === s.id);
                if (p) { p.x = s.x; p.z = s.z; p.cooldown = 0; }
            });
        } else if (this.mode === 'train') {
            const randomX = (Math.floor(Math.random() * 17) - 8) * 10;
            const randomZ = (Math.floor(Math.random() * 21) - 6) * 10;
            this.ball.x = randomX;
            this.ball.z = randomZ;

            const pTrainer = this.players.find(pl => pl.id === 1);
            if (pTrainer) { 
                pTrainer.x = 0; pTrainer.z = 140; pTrainer.cooldown = 0; 
                pTrainer.facingX = 0; pTrainer.facingZ = -1;
            }
            
            const pGK = this.players.find(pl => pl.role === 'GK');
            if (pGK) { 
                pGK.x = 0; pGK.z = -140; pGK.cooldown = 0; 
                pGK.facingX = 0; pGK.facingZ = 1;
            }
        } else if (this.mode === '1v1') {
            const randomX = (Math.floor(Math.random() * 13) - 6) * 10;
            const randomZ = (Math.floor(Math.random() * 11) - 5) * 10;
            this.ball.x = randomX;
            this.ball.z = randomZ;

            const p1 = this.players.find(pl => pl.id === 1);
            if (p1) { p1.x = 0; p1.z = 100; p1.cooldown = 0; p1.facingX = 0; p1.facingZ = -1; }
            const p2 = this.players.find(pl => pl.id === 6);
            if (p2) { p2.x = 0; p2.z = -100; p2.cooldown = 0; p2.facingX = 0; p2.facingZ = 1; }
        }
    }

    triggerSideBounce() {
        if (!this.ballBounce) return false;
        
        const side = this.ball.x > 100 ? 1 : (this.ball.x < -100 ? -1 : 0);
        if (side === 0) return false;

        this.ball.x = side * 99; // Tira da borda imediatamente para evitar recursão ou bugs
        this.ball.targetX = -side * (50 + Math.random() * 50); // Alvo entre o centro e a metade oposta
        this.ball.startX = this.ball.x;
        
        // Desvio aleatório no Z para não ser uma linha reta chata
        const randomZShift = (Math.random() - 0.5) * 150;
        this.ball.targetZ = Math.max(-140, Math.min(140, this.ball.z + randomZShift));
        this.ball.startZ = this.ball.z;
        
        this.ball.progress = 0; // Reinicia o progresso para o novo "pulo"
        this.ball.speed = 2.2; // Um pouco mais rápido no pipoco
        this.ball.arcHeight = 12;
        this.ball.isMoving = true;
        return true;
    }

    handleAction(playerId, action) {
        if (action.type === 'toggleGk') {
            this.autoGk = action.active;
            return;
        }
        if (action.type === 'toggleOpponent') {
            this.autoOpponent = action.active;
            return;
        }
        if (action.type === 'toggleBallBounce') {
            this.ballBounce = action.active;
            return;
        }

        let targetPlayer = this.players.find(pl => pl.id === playerId);
        
        // Mapeamento especial para o modo 1v1 via API
        if (this.mode === '1v1') {
            if (playerId === 1) targetPlayer = this.players.find(pl => pl.id === 1);
            if (playerId === 2) targetPlayer = this.players.find(pl => pl.id === 6);
        }

        if (!targetPlayer) return;

        if (action.isManual) {
            targetPlayer.isControlled = true;
            if (targetPlayer.controlTimeout) clearTimeout(targetPlayer.controlTimeout);
            targetPlayer.controlTimeout = setTimeout(() => { targetPlayer.isControlled = false; }, 5000); 
        }

        const p = targetPlayer;

        // Processamento global de fala (balão de texto)
        const speechText = action.text || action.thinking;
        if (speechText) {
            p.message = speechText.substring(0, 100);
            p.messageTimeout = 3.0; // Duração do balão
        }

        if (action.type === 'move') {
            if (p.cooldown > 0) return; // Prevent rapid movement spam
            const moved = this.movePlayer(p, (action.dx || 0) * 10, (action.dz || 0) * 10);
            if (moved) p.cooldown = 0.2; // Enforce a ~0.2s rhythm per tile step
        } 
        else if (action.type === 'kick') {
            const gridBallX = Math.round(this.ball.x / 10) * 10;
            const gridBallZ = Math.round(this.ball.z / 10) * 10;
            const dist = Math.max(Math.abs(p.x - gridBallX), Math.abs(p.z - gridBallZ));

            if (dist <= 10 && !this.ball.isMoving) {
                this.ball.isMoving = true;
                this.ball.startX = this.ball.x;
                this.ball.startZ = this.ball.z;
                this.ball.progress = 0;
                this.ball.lastKickerId = p.id; // Marca quem chutou
                
                const power = action.power || 1;
                // Se dirX/Z não forem enviados, usa a direção que o jogador está "olhando"
                const dirX = (action.dirX !== undefined) ? action.dirX : (p.facingX || 0);
                const dirZ = (action.dirZ !== undefined) ? action.dirZ : (p.facingZ || (p.team === 'A' ? -1 : 1));

                let distance = 0;
                if (power === 1) { distance = 80; this.ball.speed = 3.5; this.ball.arcHeight = 2.0; }
                else if (power === 2) { distance = 160; this.ball.speed = 2.5; this.ball.arcHeight = 25.0; }
                else if (power === 3) { distance = 260; this.ball.speed = 1.8; this.ball.arcHeight = 50.0; }

                this.ball.targetX = this.ball.x + (dirX * distance);
                this.ball.targetZ = this.ball.z + (dirZ * distance);
            }
        }
        else if (action.type === 'pull') {
            const gridBallX = Math.round(this.ball.x / 10) * 10;
            const gridBallZ = Math.round(this.ball.z / 10) * 10;
            const dist = Math.max(Math.abs(p.x - gridBallX), Math.abs(p.z - gridBallZ));

            if (dist <= 10 && !this.ball.isMoving) {
                // Se o jogador estiver na frente da bola (ou adjacente), puxa ela para o outro lado
                // Se estava na esquerda, vai pra direita. Se estava em cima, vai pra baixo.
                const relX = gridBallX - p.x;
                const relZ = gridBallZ - p.z;

                // A bola passa por "baixo" do jogador, indo para a posição oposta à atual em relação ao jogador
                let newBallX = p.x - relX;
                let newBallZ = p.z - relZ;

                // Se o jogador estiver EXATAMENTE em cima da bola (relX=0, relZ=0), 
                // puxamos ela para trás da direção que ele está olhando
                if (relX === 0 && relZ === 0) {
                    newBallX = p.x - (p.facingX * 10 || 0);
                    newBallZ = p.z - (p.facingZ * 10 || (p.team === 'A' ? 10 : -10));
                }

                // Validação de limites e colisões para a nova posição da bola
                const isGoalWidth = newBallX >= -30 && newBallX <= 30;
                const goalLimitZ = isGoalWidth ? 165 : 150;
                const isBallOutOfBounds = Math.abs(newBallX) > 100 || (Math.abs(newBallZ) > goalLimitZ && !isGoalWidth);
                const isPathBlocked = this.players.some(other => other.id !== p.id && other.x === newBallX && other.z === newBallZ);

                if (!isBallOutOfBounds && !isPathBlocked) {
                    this.ball.x = newBallX;
                    this.ball.z = newBallZ;
                    this.ball.y = 3;
                    this.ball.isMoving = false;
                    
                    p.message = "Puxou!";
                    p.messageTimeout = 1.0;
                    p.cooldown = 0.5; // Cooldown um pouco maior para evitar spam de puxada
                }
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
                id: p.id, team: p.team, role: p.role, x: p.x, z: p.z, name: p.name, number: p.number, message: p.message,
                facingX: p.facingX, facingZ: p.facingZ
            })),
            score: this.score,
            gameTime: this.gameTime,
            isGoal: this.isGoal
        };
    }
}
