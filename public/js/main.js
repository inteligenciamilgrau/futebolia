
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
    controls.enablePan = false; 
    controls.enableZoom = false; // Desabilitado para usarmos zoom customizado linear
    controls.minDistance = 50;
    controls.maxDistance = 600;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minPolarAngle = Math.PI / 8;
    controls.rotateSpeed = 0.4;
    controls.dampingFactor = 0.05;

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

    createGoal(-150); 
    createGoal(150);  
}

function setupSocket() {
    socket = io();

    socket.on('init', (state) => {
        state.players.forEach(pData => {
            players.set(pData.id, new Player(pData, scene, mats));
        });
        ball = new Ball(state.ball, scene);
    });

    socket.on('state-update', (state) => {
        state.players.forEach(pData => {
            const p = players.get(pData.id);
            if (p) p.update(pData);
        });
        if (ball) ball.update(state.ball);
        
        document.getElementById('score-a').innerText = state.score.A;
        document.getElementById('score-b').innerText = state.score.B;
        
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

    // Carregar preferência salva do goleiro
    const savedAutoGk = localStorage.getItem('autoGk') !== 'false'; // Default true
    ingameChkGk.checked = savedAutoGk;

    document.getElementById('btn-jogar').addEventListener('click', () => {
        startScreen.style.display = 'none';
        Sound.init();
        selectedPlayerId = prompt("Escolha seu Player ID (1-10):", "2");
        if (selectedPlayerId) socket.emit('join', { playerId: parseInt(selectedPlayerId), mode: 'play' });
    });

    document.getElementById('btn-treinar').addEventListener('click', () => {
        startScreen.style.display = 'none';
        Sound.init();
        selectedPlayerId = 1; 
        
        document.getElementById('training-controls').style.display = 'block';
        document.getElementById('mode-ctrl-title').innerText = "Opções de Treino";
        document.getElementById('gk-ctrl-label').style.display = 'flex';
        document.getElementById('opponent-ctrl-label').style.display = 'none';
        
        socket.emit('join', { playerId: selectedPlayerId, mode: 'train', autoGk: ingameChkGk.checked });
    });

    document.getElementById('btn-mano').addEventListener('click', () => {
        startScreen.style.display = 'none';
        Sound.init();
        selectedPlayerId = 1; 

        document.getElementById('training-controls').style.display = 'block';
        document.getElementById('mode-ctrl-title').innerText = "Opções 1v1";
        document.getElementById('gk-ctrl-label').style.display = 'none';
        document.getElementById('opponent-ctrl-label').style.display = 'flex';

        const autoOpponent = document.getElementById('ingame-chk-opponent').checked;
        socket.emit('join', { playerId: selectedPlayerId, mode: '1v1', autoOpponent });
    });

    // Listener para o toggle do goleiro in-game com persistência
    ingameChkGk.addEventListener('change', (e) => {
        localStorage.setItem('autoGk', e.target.checked);
        if (!selectedPlayerId) return;
        socket.emit('action', { type: 'toggleGk', active: e.target.checked });
    });

    document.getElementById('ingame-chk-opponent').addEventListener('change', (e) => {
        if (!selectedPlayerId) return;
        socket.emit('action', { type: 'toggleOpponent', active: e.target.checked });
    });

    const keysPressed = new Set();
    
    const moveKeys = {
        'w': { dx: -1, dz: 0 }, 's': { dx: 1, dz: 0 }, 'a': { dx: 0, dz: 1 }, 'd': { dx: 0, dz: -1 },
        'arrowup': { dx: -1, dz: 0 }, 'arrowdown': { dx: 1, dz: 0 }, 'arrowleft': { dx: 0, dz: 1 }, 'arrowright': { dx: 0, dz: -1 }
    };

    window.addEventListener('keydown', (e) => {
        if (!selectedPlayerId) return;
        const key = e.key.toLowerCase();
        keysPressed.add(key);

        let action = null;
        if (['1', '2', '3'].includes(key)) action = { type: 'kick', power: parseInt(key), isManual: true };
        if (key === 't') {
            const text = prompt("Mensagem:");
            if (text) action = { type: 'speak', text, isManual: true };
        }
        if (action) socket.emit('action', action);
    });

    window.addEventListener('keyup', (e) => {
        keysPressed.delete(e.key.toLowerCase());
    });

    // Loop de movimento mais lento (200ms) para ritmo fixo
    setInterval(() => {
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
    }, 200); 
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();
