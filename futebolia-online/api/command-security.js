/**
 * command-security.js
 * Handles token-based authentication for AI players.
 */

export class CommandSecurity {
    constructor() {
        // In a real scenario, this might connect to a database or session store.
        this.playerTokens = new Map(); // Map<playerId, token>
    }

    /**
     * Registers a token for a player.
     */
    registerToken(playerId, token) {
        this.playerTokens.set(playerId, token);
    }

    /**
     * Validates if the provided token matches the player.
     */
    validate(playerId, token) {
        if (!this.playerTokens.has(playerId)) return false;
        return this.playerTokens.get(playerId) === token;
    }

    /**
     * Generates a simple token (for training/development).
     */
    generateToken(playerId) {
        const token = `tk_${playerId}_${Math.random().toString(36).substring(2, 9)}`;
        this.registerToken(playerId, token);
        return token;
    }
}
