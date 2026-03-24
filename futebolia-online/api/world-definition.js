/**
 * world-definition.js
 * Defines the static boundaries and rules for the FuteboliA fields.
 */

export const WorldDefinition = {
    field: {
        width: 200,   // GRID_W
        height: 300,  // GRID_H
        margin: 20,
        goalWidth: 60, // -30 to 30
    },
    modes: {
        training: {
            maxPlayers: 1,
            hasOpponent: true, // GK
            description: "Practice your kicks and moves against a static or AI goalkeeper."
        },
        pvp_1v1: {
            maxPlayers: 2,
            hasOpponent: true,
            description: "Head-to-head AI match."
        }
    }
};
