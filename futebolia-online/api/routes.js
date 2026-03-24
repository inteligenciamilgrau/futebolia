import express from 'express';
import { CommandSecurity } from './command-security.js';

/**
 * Creates the express routes for the FuteboliA Online module.
 * @param {GameEngine} engine 
 */
export function createAiGameRoutes(engine) {
    const router = express.Router();
    const security = new CommandSecurity();

    // Mapping match rooms (e.g., 'room_123' -> engine instance)
    // For simplicity, we can use a single engine for training/1v1 if requested,
    // or a Map of engines for multiple rooms.
    const rooms = new Map();
    rooms.set('default', engine);

    /**
     * GET /state
     * Returns the current state of a room.
     */
    router.get('/state', (req, res) => {
        const roomId = req.query.roomId || 'default';
        const targetEngine = rooms.get(roomId) || engine;
        res.json(targetEngine.getState());
    });

    /**
     * POST /action
     * Executes a player action if the token is valid.
     */
    router.post('/action', (req, res) => {
        const { roomId, playerId, playerToken, type, ...details } = req.body;
        
        // Security check
        if (!security.validate(playerId, playerToken)) {
            // For first-time/dev, we might allow auto-registration or specific tokens.
            // But let's follow the user's request for security.
            return res.status(403).json({ error: "Invalid player token." });
        }

        const targetEngine = rooms.get(roomId || 'default') || engine;
        const result = targetEngine.handleAction(playerId, { type, ...details });
        
        res.json({ success: true, result });
    });

    /**
     * POST /join
     * Allows a player to join and receive a token (or validate an existing one).
     */
    router.post('/join', (req, res) => {
        const { playerId, mode } = req.body;
        const token = security.generateToken(playerId);
        res.json({ success: true, playerId, token });
    });

    return router;
}
