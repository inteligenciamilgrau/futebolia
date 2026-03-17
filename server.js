
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameEngine } from './src/game-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // Habilita parse de JSON no Body

const game = new GameEngine();

// Endpoint para pedir o estado do jogo via HTTP (como solicitado)
app.get('/state', (req, res) => {
    res.json(game.getState());
});

// Endpoint para enviar comandos (API REST)
app.post('/action', (req, res) => {
    const action = req.body;
    const targetId = action.playerId;
    
    if (targetId) {
        game.handleAction(targetId, action);
        res.json({ success: true, state: game.getState() });
    } else {
        res.status(400).json({ success: false, error: "playerId is required" });
    }
});

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    // Enviar o estado inicial
    socket.emit('init', game.getState());

    socket.on('join', (playerId) => {
        socket.playerId = playerId;
        console.log(`Socket ${socket.id} assumiu jogador ${playerId}`);
    });

    socket.on('action', (action) => {
        // A ferramenta de teste envia playerId explicitamente
        const targetId = action.playerId || socket.playerId;
        if (targetId) {
            game.handleAction(targetId, action);
        }
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Game Loop no servidor
let lastTick = Date.now();
setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    
    const state = game.update(dt);
    io.emit('state-update', state);
}, 1000 / 20); 

httpServer.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
