// src/constants.js
module.exports = {
    TICK_RATE: 60,         // ms entre cada update (1000/60 = ~16.6ms)
    MATCH_DURATION: 120,   // Duração da partida em segundos
    
    // Física e Movimentação
    PLAYER_SPEED: 300,     // Pixels por segundo
    JUMP_FORCE: 650,       // Força inicial do pulo
    GRAVITY: 800,          // Força da gravidade puxando para baixo
    BULLET_SPEED: 600,     // Velocidade do projétil
    
    // Dimensões
    PLAYER_W: 30,
    PLAYER_H: 40,
    BULLET_W: 8,
    BULLET_H: 4,
    
    // Regras
    RESPAWN_TIME: 2,       // Segundos para renascer
    TEAMS: { RED: 0, BLUE: 1 }
};