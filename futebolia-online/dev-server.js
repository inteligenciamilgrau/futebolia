import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAiGameRoutes } from './api/routes.js';
import { GameEngine } from './api/engine.js';
import { createServer } from 'http';
import { Server } from 'socket.io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());

// 1. Initialize Game Engine
const engine = new GameEngine({ mode: 'train' });

// 2. Mount API Routes (as the platform would)
app.use('/api/v1/games/futebolia-online', createAiGameRoutes(engine));

// 3. Serve Frontend
app.use(express.static(path.join(__dirname, 'web')));

// 4. Socket.io logic (simplified for testing)
const gameNamespace = io.of('/api/v1/games/futebolia-online');
gameNamespace.on('connection', (socket) => {
    console.log('AI or Player connected via socket:', socket.id);
    
    socket.emit('init', engine.getState());

    socket.on('join', (data) => {
        engine.mode = data.mode || 'train';
        engine.reset();
        socket.emit('init', engine.getState());
    });

    socket.on('action', (data) => {
        engine.handleAction(data.playerId || 1, data);
    });
});

// Update loop
setInterval(() => {
    engine.update(1/60);
    gameNamespace.emit('state-update', engine.getState());
}, 1000/60);

const PORT = 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 FuteboliA Online Dev Server running at: http://localhost:${PORT}`);
    console.log(`🎮 Web UI: http://localhost:${PORT}/index.html`);
    console.log(`🤖 API: http://localhost:${PORT}/api/v1/games/futebolia-online/state`);
});
