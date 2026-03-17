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
app.use(express.json());

const rooms = new Map(); // roomId -> GameEngine
rooms.set('play', new GameEngine({ mode: 'play' }));
rooms.set('train', new GameEngine({ mode: 'train' }));
rooms.set('1v1', new GameEngine({ mode: '1v1' }));

// Endpoints HTTP
app.get('/state', (req, res) => {
    const roomId = req.query.roomId || 'play';
    const game = rooms.get(roomId);
    if (!game) return res.status(404).json({ error: "Room not found" });
    res.json(game.getState());
});

app.post('/action', (req, res) => {
    const action = req.body;
    const roomId = action.roomId || 'play';
    const game = rooms.get(roomId);
    
    if (!game) return res.status(404).json({ error: "Room not found" });

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

    socket.on('join', (data) => {
        let playerId = typeof data === 'object' ? data.playerId : data;
        let mode = typeof data === 'object' ? data.mode : 'play';
        let autoGk = typeof data === 'object' ? data.autoGk : true;
        let autoOpponent = typeof data === 'object' ? data.autoOpponent : true;
        let ballBounce = typeof data === 'object' ? data.ballBounce : true;

        let roomId = mode; 
        if (mode === 'train') roomId = 'train';
        if (mode === 'play') roomId = 'play';
        
        // Aplica configurações se a sala já existir
        const game = rooms.get(roomId);
        if (game) {
            if (mode === 'train') game.autoGk = autoGk;
            if (mode === '1v1') {
                game.autoOpponent = autoOpponent;
                game.ballBounce = ballBounce;
            }
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerId = playerId;
        console.log(`Socket ${socket.id} entrou na sala ${roomId} como jogador ${playerId}`);
        
        socket.emit('init', rooms.get(roomId).getState());
    });

    socket.on('action', (action) => {
        if (!socket.roomId) return;
        const game = rooms.get(socket.roomId);
        if (!game) return;

        const targetId = action.playerId || socket.playerId;
        if (targetId) {
            game.handleAction(targetId, action);
        }
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
        if (socket.roomId && socket.roomId.startsWith('train_')) {
            rooms.delete(socket.roomId);
            console.log(`Sala de treino ${socket.roomId} encerrada.`);
        }
    });
});

let lastTick = Date.now();
setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    
    for (const [roomId, game] of rooms.entries()) {
        const state = game.update(dt);
        io.to(roomId).emit('state-update', state);
    }
}, 1000 / 20); 

httpServer.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
