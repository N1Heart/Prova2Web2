// src/entities.js
const { PLAYER_W, PLAYER_H, BULLET_W, BULLET_H ,MATCH_DURATION} = require('./constants');

// Cria o estado inicial de um jogador
function createPlayer(id, name, team, startX, startY) {
    return {
        id,
        name,
        team,
        x: startX,
        y: startY,
        width: PLAYER_W,
        height: PLAYER_H,
        vx: 0,               // Velocidade no eixo X
        vy: 0,               // Velocidade no eixo Y
        onGround: false,     // Flag para saber se pode pular
        alive: true,
        respawnTimer: 0,
        kills: 0,
        deaths: 0,
        shootCooldown: 0,
        // O input guarda a última intenção de movimento que o cliente enviou
        input: {
            left: false,
            right: false,
            jump: false,
            down: false,
            shoot: false,
            aimX: 0,
            aimY: 0
        }
    };
}

// Cria uma nova bala no mundo
function createBullet(id, ownerId, x, y, vx, vy) {
    return {
        id,
        ownerId,             // Para saber quem atirou e dar o kill
        x,
        y,
        width: BULLET_W,
        height: BULLET_H,
        vx,
        vy
    };
}

// Inicializa a estrutura do estado global da partida
function createGameState() {
    return {
       matchTime: MATCH_DURATION,
        currentMapIndex: 0,
        isEnded: false,
        endTimer: 0,
        winner: null,
        players: {},
        bullets: [],
        killFeed: [], // <-- NOVO: Array para guardar os abates
        scores: {
            0: 0,
            1: 0           // Pontos do time BLUE
        }
    };
}

module.exports = {
    createPlayer,
    createBullet,
    createGameState
};