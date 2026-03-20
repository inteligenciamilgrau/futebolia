
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Sound from './audio.js';
import { Player } from './entities/player.js';
import { Ball } from './entities/ball.js';

let scene, camera, renderer, controls;
let socket;
let players = new Map();
let ball;
let selectedPlayerId = null;

const mats = {
    grass1: new THREE.MeshLambertMaterial({ color: 0x3a7d44 }),
    grass2: new THREE.MeshLambertMaterial({ color: 0x438d4e }),
    line: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    goal: new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    skin: new THREE.MeshLambertMaterial({ color: 0xffccaa }),
    eye: new THREE.MeshLambertMaterial({ color: 0x222222 }),
    braShirt: new THREE.MeshLambertMaterial({ color: 0xfde100 }),
    braShorts: new THREE.MeshLambertMaterial({ color: 0x0038a8 }), 
    braGK: new THREE.MeshLambertMaterial({ color: 0x009b3a }),    
    argShirt: new THREE.MeshLambertMaterial({ color: 0x75b2dd }), 
    argShorts: new THREE.MeshLambertMaterial({ color: 0x111111 }), 
    argGK: new THREE.MeshLambertMaterial({ color: 0xff7722 })
};

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(190, 135, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true; // Habilitado para mover o campo
    controls.enableZoom = false; // Desabilitado para usarmos zoom customizado linear
    
    // Configura botões do mouse: Esquerdo: ROTATE (Orbit), Direito: PAN (Mover campo)
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };

    controls.minDistance = 50;
    controls.maxDistance = 600;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minPolarAngle = Math.PI / 8;
    controls.rotateSpeed = 0.5;
    controls.dampingFactor = 0.05;

    // Previne o menu de contexto no clique direito para não atrapalhar o Orbit
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // Zoom Customizado Linear
    renderer.domElement.addEventListener('wheel', (event) => {
        event.preventDefault();
        
        // Define um fator de zoom constante e fixo independente da distância
        const zoomStep = 20; 
        const direction = Math.sign(event.deltaY);
        
        // Aplica o zoom aproximando ou afastando a câmera ao longo do vetor onde ela está olhando
        const target = controls.target;
        const offset = new THREE.Vector3().copy(camera.position).sub(target);
        const distance = offset.length();

        // Limites de zoom
        const newDistance = Math.max(controls.minDistance, Math.min(controls.maxDistance, distance + (direction * zoomStep)));

        // Se mudou a distância, atualiza a posição
        if (newDistance !== distance) {
            offset.normalize().multiplyScalar(newDistance);
            camera.position.copy(target).add(offset);
        }
    }, { passive: false });


    // Background & Fog
    scene.background = new THREE.Color('#87CEEB');
    scene.fog = new THREE.FogExp2('#87CEEB', 0.0015);

    // Better Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 300, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 200;
    dirLight.shadow.camera.bottom = -200;
    dirLight.shadow.camera.left = -200;
    dirLight.shadow.camera.right = 200;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    buildPitch();
    setupUI();
    setupSocket();

    animate();
}

function buildPitch() {
    const GRID_W = 200, GRID_H = 300, MARGIN = 20;
    const floorGroup = new THREE.Group();
    for (let i = -GRID_W/2 - MARGIN; i <= GRID_W/2 + MARGIN; i += 10) {
        for (let j = -GRID_H/2 - MARGIN; j <= GRID_H/2 + MARGIN; j += 10) {
            const planeGeo = new THREE.PlaneGeometry(10, 10);
            const mat = (Math.abs(i/10) + Math.abs(j/10)) % 2 === 0 ? mats.grass1 : mats.grass2;
            const plane = new THREE.Mesh(planeGeo, mat);
            plane.rotation.x = -Math.PI / 2;
            plane.position.set(i, 0, j);
            plane.receiveShadow = true;
            floorGroup.add(plane);
        }
    }
    scene.add(floorGroup);

    function addLine(w, h, x, z) {
        const geo = new THREE.PlaneGeometry(w, h);
        const mesh = new THREE.Mesh(geo, mats.line);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.1, z);
        scene.add(mesh);
    }

    // Centro
    addLine(GRID_W + 10, 2, 0, 0); 
    
    // Área Brasil
    addLine(82, 2, 0, -120); 
    addLine(2, 35, -40, -137.5); 
    addLine(2, 35, 40, -137.5); 
    
    // Área Argentina
    addLine(82, 2, 0, 120); 
    addLine(2, 35, -40, 137.5); 
    addLine(2, 35, 40, 137.5); 

    // Laterais e Fundos
    addLine(2, 302, -100, 0);  
    addLine(2, 302, 100, 0);   
    addLine(202, 2, 0, -150);  
    addLine(202, 2, 0, 150);   

    // Círculo Central
    const ringGeo = new THREE.RingGeometry(28, 30, 32);
    const ringMesh = new THREE.Mesh(ringGeo, mats.line);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.1, 0);
    scene.add(ringMesh);

    function createGoal(zPos) {
        const goalGroup = new THREE.Group();
        const postGeo = new THREE.BoxGeometry(2, 25, 2);
        const topGeo = new THREE.BoxGeometry(64, 2, 2);
        
        const post1 = new THREE.Mesh(postGeo, mats.goal);
        post1.position.set(-30, 12.5, 0);
        post1.castShadow = true;
        
        const post2 = new THREE.Mesh(postGeo, mats.goal);
        post2.position.set(30, 12.5, 0);
        post2.castShadow = true;
        
        const top = new THREE.Mesh(topGeo, mats.goal);
        top.position.set(0, 25, 0);
        top.castShadow = true;

        goalGroup.add(post1, post2, top);
        goalGroup.position.set(0, 0, zPos);
        scene.add(goalGroup);
    }

    createGoal(-150); // Argentina Goal
    createGoal(150);  // Brasil Goal

    function createFlag(x, z, team) {
        const flagGroup = new THREE.Group();
        
        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.5, 0.5, 30, 8);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 15;
        pole.castShadow = true;
        flagGroup.add(pole);

        // Flag Canvas Drawing
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');

        if (team === 'BRA') {
            // Fundo Verde
            ctx.fillStyle = '#009b3a';
            ctx.fillRect(0, 0, 120, 80);
            // Losango Amarelo
            ctx.fillStyle = '#fde100';
            ctx.beginPath();
            ctx.moveTo(60, 10);
            ctx.lineTo(110, 40);
            ctx.lineTo(60, 70);
            ctx.lineTo(10, 40);
            ctx.fill();
            // Círculo Azul
            ctx.fillStyle = '#002776';
            ctx.beginPath();
            ctx.arc(60, 40, 18, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Listras Argentina
            ctx.fillStyle = '#75b2dd';
            ctx.fillRect(0, 0, 120, 80);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 26, 120, 28);
            // Sol
            ctx.fillStyle = '#fdb813';
            ctx.beginPath();
            ctx.arc(60, 40, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        const flagGeo = new THREE.PlaneGeometry(15, 10);
        const flagMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(7.5, 23, 0); // Offset from pole
        flagGroup.add(flag);

        flagGroup.position.set(x, 0, z);
        scene.add(flagGroup);
    }

    // Bandeiras nas defesas corretas
    createFlag(-45, 150, 'BRA');  // Perto do gol do Brasil
    createFlag(45, -150, 'ARG'); // Perto do gol da Argentina
}

function setupSocket() {
    socket = io();

    socket.on('init', (state) => {
        state.players.forEach(pData => {
            pData.isActive = state.isGameActive;
            players.set(pData.id, new Player(pData, scene, mats));
        });
        ball = new Ball(state.ball, scene);
    });

    socket.on('state-update', (state) => {
        state.players.forEach(pData => {
            pData.isActive = state.isGameActive;
            const p = players.get(pData.id);
            if (p) p.update(pData);
        });
        if (ball) ball.update(state.ball);
        
        document.getElementById('score-a').innerText = state.score.A;
        document.getElementById('score-b').innerText = state.score.B;
        if (state.teamNames) {
            const timeA = document.querySelector('.time-a');
            const timeB = document.querySelector('.time-b');
            if (timeA) timeA.innerText = state.teamNames.A.toUpperCase();
            if (timeB) timeB.innerText = state.teamNames.B.toUpperCase();
        }

        // HUD visibility based on mode
        const clockContainer = document.getElementById('clock-container');
        if (clockContainer) {
            clockContainer.style.display = (state.mode === 'train') ? 'none' : 'flex';
        }

        // Clock update (conic-gradient)
        const clockFill = document.getElementById('clock-fill');
        const halfIndicator = document.getElementById('half-indicator');
        const gameTimeText = document.getElementById('game-time');
        
        if (state.gameTime !== undefined && state.mode !== 'train') {
            const timeVal = Math.max(0, state.gameTime);
            const mins = Math.floor(timeVal / 60).toString().padStart(2, '0');
            const secs = Math.floor(timeVal % 60).toString().padStart(2, '0');
            if (gameTimeText) gameTimeText.innerText = `${mins}:${secs}`;

            if (clockFill) {
                const totalHalf = state.timePerHalf || 120; // Utiliza tempo configurado pelo engine
                const pct = Math.max(0, Math.min(100, (timeVal / totalHalf) * 100));
                let color = '#10b981'; // green
                if (pct <= 20) color = '#ef4444'; // red
                else if (pct <= 50) color = '#eab308'; // yellow
                clockFill.style.background = `conic-gradient(${color} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
            }
        }
        if (halfIndicator && state.currentHalf !== undefined) {
            if (state.isGameActive === false && state.gameTime <= 0 && state.currentHalf === 2) {
                halfIndicator.innerText = 'FIM!';
                halfIndicator.style.background = 'rgba(239,68,68,0.5)';
            } else if (state.currentHalf === 2) {
                halfIndicator.innerText = '2º T';
                halfIndicator.style.background = 'rgba(244,114,182,0.4)';
            } else {
                halfIndicator.innerText = '1º T';
                halfIndicator.style.background = 'rgba(0,0,0,0.7)';
            }
        }
        
        const msg = document.getElementById('center-messages');
        if (state.isGoal) {
            msg.innerText = "GOL!";
            msg.style.display = 'block';
        } else {
            msg.style.display = 'none';
        }
    });
}

function setupUI() {
    const startScreen = document.getElementById('start-screen');
    const ingameChkGk = document.getElementById('ingame-chk-goleiro');

    // Carregar preferência salva do goleiro e oponente
    const savedAutoGk = localStorage.getItem('autoGk') !== 'false'; // Default true
    ingameChkGk.checked = savedAutoGk;

    const chkOpponent = document.getElementById('ingame-chk-opponent');
    const savedAutoOpponent = localStorage.getItem('autoOpponent') === 'true'; // Default false
    chkOpponent.checked = savedAutoOpponent;

    const chkBounce = document.getElementById('ingame-chk-bounce');
    const savedBallBounce = localStorage.getItem('ballBounce') !== 'false'; // Default true
    chkBounce.checked = savedBallBounce;

    const speedSelect = document.getElementById('game-speed-select');
    const savedSpeed = localStorage.getItem('gameSpeed') || "1.0";
    speedSelect.value = savedSpeed;

    const chkRealTime = document.getElementById('ingame-chk-realtime');
    const savedRealTime = localStorage.getItem('realTimeClock') === 'true';
    chkRealTime.checked = savedRealTime;

    document.getElementById('btn-jogar').addEventListener('click', () => {
        startScreen.style.display = 'none';
        Sound.init();
        selectedPlayerId = prompt("Escolha seu Player ID (1-10):", "2");
        const gameTime = localStorage.getItem('arena_game_time_minutes') || 2;
        const p1Name = localStorage.getItem('arena_p1_name') || "";
        const p2Name = localStorage.getItem('arena_p2_name') || "";
        const p1IsTeam = localStorage.getItem('arena_p1_is_team') === 'true';
        const p2IsTeam = localStorage.getItem('arena_p2_is_team') === 'true';
        
        if (selectedPlayerId) socket.emit('join', { 
            playerId: parseInt(selectedPlayerId), 
            mode: 'play', 
            gameTime,
            p1Name, p2Name, p1IsTeam, p2IsTeam,
            gameSpeed: parseFloat(speedSelect.value),
            realTimeClock: chkRealTime.checked
        });
    });

    document.getElementById('btn-treinar').addEventListener('click', () => {
        startScreen.style.display = 'none';
        Sound.init();
        selectedPlayerId = 1; 
        
        document.getElementById('training-controls').style.display = 'block';
        document.getElementById('mode-ctrl-title').innerText = "Opções de Treino";
        document.getElementById('gk-ctrl-label').style.display = 'flex';
        document.getElementById('opponent-ctrl-label').style.display = 'none';
        document.getElementById('bounce-ctrl-label').style.display = 'none';
        const gameTime = localStorage.getItem('arena_game_time_minutes') || 2;
        const p1Name = localStorage.getItem('arena_p1_name') || "";
        const p2Name = localStorage.getItem('arena_p2_name') || "";
        const p1IsTeam = localStorage.getItem('arena_p1_is_team') === 'true';
        const p2IsTeam = localStorage.getItem('arena_p2_is_team') === 'true';

        socket.emit('join', { 
            playerId: selectedPlayerId, 
            mode: 'train', 
            autoGk: ingameChkGk.checked, 
            gameTime,
            p1Name, p2Name, p1IsTeam, p2IsTeam,
            gameSpeed: parseFloat(speedSelect.value),
            realTimeClock: chkRealTime.checked
        });
    });

    document.getElementById('btn-mano').addEventListener('click', () => {
        startScreen.style.display = 'none';
        Sound.init();
        selectedPlayerId = 1; 

        document.getElementById('training-controls').style.display = 'block';
        document.getElementById('mode-ctrl-title').innerText = "Opções 1v1";
        document.getElementById('gk-ctrl-label').style.display = 'none';
        document.getElementById('opponent-ctrl-label').style.display = 'flex';
        document.getElementById('bounce-ctrl-label').style.display = 'flex';
        const autoOpponent = document.getElementById('ingame-chk-opponent').checked;
        const ballBounce = document.getElementById('ingame-chk-bounce').checked;
        const gameTime = localStorage.getItem('arena_game_time_minutes') || 2;
        const p1Name = localStorage.getItem('arena_p1_name') || "";
        const p2Name = localStorage.getItem('arena_p2_name') || "";
        const p1IsTeam = localStorage.getItem('arena_p1_is_team') === 'true';
        const p2IsTeam = localStorage.getItem('arena_p2_is_team') === 'true';

        socket.emit('join', { 
            playerId: selectedPlayerId, 
            mode: '1v1', 
            autoOpponent, 
            ballBounce, 
            gameTime,
            p1Name, p2Name, p1IsTeam, p2IsTeam,
            gameSpeed: parseFloat(speedSelect.value),
            realTimeClock: chkRealTime.checked
        });
    });

    // Listener para o toggle do goleiro in-game com persistência
    ingameChkGk.addEventListener('change', (e) => {
        localStorage.setItem('autoGk', e.target.checked);
        if (!selectedPlayerId) return;
        socket.emit('action', { type: 'toggleGk', active: e.target.checked });
    });

    document.getElementById('ingame-chk-opponent').addEventListener('change', (e) => {
        localStorage.setItem('autoOpponent', e.target.checked);
        if (!selectedPlayerId) return;
        socket.emit('action', { type: 'toggleOpponent', active: e.target.checked });
    });

    document.getElementById('ingame-chk-bounce').addEventListener('change', (e) => {
        localStorage.setItem('ballBounce', e.target.checked);
        if (!selectedPlayerId) return;
        socket.emit('action', { type: 'toggleBallBounce', active: e.target.checked });
    });

    speedSelect.addEventListener('change', (e) => {
        localStorage.setItem('gameSpeed', e.target.value);
        if (!selectedPlayerId) return;
        socket.emit('action', { type: 'setGameSpeed', speed: parseFloat(e.target.value) });
        if (window.updateManualMoveInterval) window.updateManualMoveInterval();
    });

    chkRealTime.addEventListener('change', (e) => {
        localStorage.setItem('realTimeClock', e.target.checked);
        if (!selectedPlayerId) return;
        socket.emit('action', { type: 'setRealTimeClock', active: e.target.checked });
    });

    const keysPressed = new Set();
    
    const moveKeys = {
        'w': true, 'a': true, 's': true, 'd': true,
        'arrowup': true, 'arrowleft': true, 'arrowdown': true, 'arrowright': true
    };

    function showSpeedToast(text) {
        let toast = document.getElementById('speed-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'speed-toast';
            toast.style.position = 'absolute';
            toast.style.top = '15%';
            toast.style.left = '50%';
            toast.style.transform = 'translate(-50%, 0)';
            toast.style.background = 'rgba(0, 0, 0, 0.75)';
            toast.style.color = '#fff';
            toast.style.border = '2px solid #fff';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '8px';
            toast.style.fontFamily = 'monospace';
            toast.style.fontSize = '20px';
            toast.style.fontWeight = 'bold';
            toast.style.zIndex = '9999';
            toast.style.transition = 'opacity 0.2s ease-in-out';
            toast.style.pointerEvents = 'none';
            document.body.appendChild(toast);
        }
        
        toast.innerHTML = `⏩ ${text}`;
        toast.style.opacity = '1';
        
        if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
        toast.hideTimeout = setTimeout(() => {
            toast.style.opacity = '0';
        }, 1500);
    }

    function changeSpeedStep(step) {
        const speedSelect = document.getElementById('game-speed-select');
        if (!speedSelect) return;
        const index = speedSelect.selectedIndex;
        let newIndex = index + step;
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= speedSelect.options.length) newIndex = speedSelect.options.length - 1;
        
        if (newIndex !== index) {
            speedSelect.selectedIndex = newIndex;
            speedSelect.dispatchEvent(new Event('change'));
            
            showSpeedToast(speedSelect.options[newIndex].text);
        }
    }

    window.addEventListener('keydown', (e) => {
        if (!selectedPlayerId) return;
        const key = e.key.toLowerCase();
        
        if (moveKeys[key]) {
            keysPressed.add(key);
        }

        // Atalhos de velocidade (Mais Rápido / Mais Lento)
        if (e.key === '+' || e.key === '=') {
            changeSpeedStep(1);
            e.preventDefault(); // Prevent browser zoom
        } else if (e.key === '-') {
            changeSpeedStep(-1);
            e.preventDefault(); // Prevent browser zoom
        }

        let action = null;
        if (['1', '2', '3'].includes(key)) action = { type: 'kick', power: parseInt(key), isManual: true };
        if (key === 'p') action = { type: 'pull', isManual: true };
        if (key === 't') {
            const text = prompt("Mensagem:");
            if (text) action = { type: 'speak', text, isManual: true };
        }
        if (action) socket.emit('action', action);

        // Reset da câmera (Tecla R)
        if (key === 'r') {
            camera.position.set(190, 135, 0);
            controls.target.set(0, 0, 0);
            controls.update();
        }
    });

    window.addEventListener('keyup', (e) => {
        keysPressed.delete(e.key.toLowerCase());
    });

    // Loop de movimento mais lento (200ms) ajustado pela velocidade
    let moveIntervalTimer;
    window.updateManualMoveInterval = function() {
        if (moveIntervalTimer) clearInterval(moveIntervalTimer);
        const speed = parseFloat(speedSelect.value) || 1.0;
        const interval = Math.max(50, 200 / speed);

        moveIntervalTimer = setInterval(() => {
            if (!selectedPlayerId) return;
            
            let dx = 0;
            let dz = 0;
            
            if (keysPressed.has('w') || keysPressed.has('arrowup')) dx -= 1;
            if (keysPressed.has('s') || keysPressed.has('arrowdown')) dx += 1;
            if (keysPressed.has('a') || keysPressed.has('arrowleft')) dz += 1;
            if (keysPressed.has('d') || keysPressed.has('arrowright')) dz -= 1;

            if (dx !== 0 || dz !== 0) {
                socket.emit('action', { type: 'move', dx, dz, isManual: true });
            }
        }, interval); 
    };

    window.updateManualMoveInterval();
}

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    
    // Animate players at 60fps independently of network
    players.forEach(p => {
        if (p.tick) p.tick(dt);
    });
    
    controls.update();
    renderer.render(scene, camera);
}

window.toggleMenu = function() {
    const menu = document.getElementById('game-menu');
    menu.classList.toggle('minimized');
};

init();
