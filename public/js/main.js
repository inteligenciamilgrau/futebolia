
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
    addLine(2, 312, -105, 0);  
    addLine(2, 312, 105, 0);   
    addLine(212, 2, 0, -155);  
    addLine(212, 2, 0, 155);   

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

    createGoal(-155); 
    createGoal(155);  
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
    document.getElementById('start-btn').addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        Sound.init();
        // Escolha de ID simplificada para teste
        selectedPlayerId = prompt("Escolha seu Player ID (1-10):", "2");
        if (selectedPlayerId) socket.emit('join', parseInt(selectedPlayerId));
    });

    window.addEventListener('keydown', (e) => {
        if (!selectedPlayerId) return;
        const key = e.key.toLowerCase();
        let action = null;

        if (key === 'w' || key === 'arrowup') action = { type: 'move', dx: -1, dz: 0, isManual: true };
        if (key === 's' || key === 'arrowdown') action = { type: 'move', dx: 1, dz: 0, isManual: true };
        if (key === 'a' || key === 'arrowleft') action = { type: 'move', dx: 0, dz: 1, isManual: true };
        if (key === 'd' || key === 'arrowright') action = { type: 'move', dx: 0, dz: -1, isManual: true };

        if (['1', '2', '3'].includes(key)) action = { type: 'kick', power: parseInt(key), isManual: true };
        
        if (key === 't') { // Tecla T para falar
            const text = prompt("Mensagem:");
            if (text) action = { type: 'speak', text, isManual: true };
        }

        if (action) socket.emit('action', action);
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();
