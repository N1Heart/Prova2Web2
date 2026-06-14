// src/gameLoop.js
const { TICK_RATE, GRAVITY, PLAYER_SPEED, JUMP_FORCE, RESPAWN_TIME, BULLET_SPEED, MATCH_DURATION } = require('./constants');
const maps = require('./maps');
const { createBullet } = require('./entities');

// Verifica se dois retângulos estão se sobrepondo (Colisão AABB)
// Verifica se dois retângulos estão se sobrepondo (Colisão AABB inteligente)
function checkAABB(r1, r2) {
    // Pega a largura e altura independente de como foram escritas (w ou width)
    const w1 = r1.width !== undefined ? r1.width : r1.w;
    const h1 = r1.height !== undefined ? r1.height : r1.h;
    const w2 = r2.width !== undefined ? r2.width : r2.w;
    const h2 = r2.height !== undefined ? r2.height : r2.h;

    return (
        r1.x < r2.x + w2 &&
        r1.x + w1 > r2.x &&
        r1.y < r2.y + h2 &&
        r1.y + h1 > r2.y
    );
}

function resetMatch(gameState) {
    gameState.matchTime = MATCH_DURATION;
    gameState.scores[0] = 0;
    gameState.scores[1] = 0;
    gameState.bullets = []; // Limpa os tiros voando
    
    // Passa para o próximo mapa da lista
    if (gameState.nextMapIndex !== undefined) {
        gameState.currentMapIndex = gameState.nextMapIndex;
    }
    const currentMap = maps[gameState.currentMapIndex];

    // Renasce todos os jogadores no novo mapa
    for (const id in gameState.players) {
        const p = gameState.players[id];
        const spawn = currentMap.spawnPoints[p.team][0]; // Pega o ponto inicial do time
        
        p.alive = true;
        p.respawnTimer = 0;
        p.x = spawn.x;
        p.y = spawn.y;
        p.vx = 0;
        p.vy = 0;
    }
}

// Atualiza o estado do jogo inteiro a cada tick
// Atualiza o estado do jogo inteiro a cada tick
function updateGame(gameState, dt) {

    const playerCount = Object.keys(gameState.players).length;

    for (let i = gameState.killFeed.length - 1; i >= 0; i--) {
        gameState.killFeed[i].timer -= dt;
        if (gameState.killFeed[i].timer <= 0) {
            gameState.killFeed.splice(i, 1); // Remove a mensagem quando o tempo acaba
        }
    }
    
    // 1. Se estiver vazio, reseta tudo e não faz nada
    if (playerCount === 0) {
        gameState.matchTime = MATCH_DURATION;
        gameState.isEnded = false;
        gameState.endTimer = 0;
        gameState.winner = null;
        return;
    } 

    // 2. Se a partida JÁ ACABOU, processa apenas o timer do popup
    if (gameState.isEnded) {
        gameState.endTimer -= dt;
        if (gameState.endTimer <= 0) {
            // Terminou os 5 segundos do popup, agora limpa as flags e muda o mapa
            gameState.isEnded = false;
            gameState.winner = null;
            resetMatch(gameState);
        }
        return; // Congela toda a física e sai da função aqui!
    }

    // 3. Se a partida NÃO acabou, processa o relógio normal
    gameState.matchTime -= dt;
    if (gameState.matchTime <= 0) {
        gameState.matchTime = 0;
        gameState.isEnded = true;
        gameState.endTimer = 5; // Define 5 segundos apenas UMA vez
        
        let nextMap;
        do {
            nextMap = Math.floor(Math.random() * maps.length);
        } while (nextMap === gameState.currentMapIndex && maps.length > 1);
        gameState.nextMapIndex = nextMap;
        // Calcula quem fez mais pontos para definir o vencedor
        const scoreRed = gameState.scores[0];
        const scoreBlue = gameState.scores[1];
        
        if (scoreRed > scoreBlue) gameState.winner = 'RED';
        else if (scoreBlue > scoreRed) gameState.winner = 'BLUE';
        else gameState.winner = 'EMPATE';
        
        return;
    }
    
    const currentMap = maps[gameState.currentMapIndex];
    
    // --- 1. ATUALIZA JOGADORES ---
    for (const id in gameState.players) {
        const p = gameState.players[id];

        if (!p.alive) {
            p.respawnTimer -= dt;
            if (p.respawnTimer <= 0) {
                p.alive = true;
                // Respawn simplificado no primeiro ponto do time
                const spawn = currentMap.spawnPoints[p.team][0];
                p.x = spawn.x;
                p.y = spawn.y;
                p.vx = 0;
                p.vy = 0;
            }
            continue; // Se está morto, não processa física
        }

        // A. Aplica gravidade e input do jogador
        p.vy += GRAVITY * dt;

if (p.input.down && !p.onGround) {
            // Aplica uma força extra equivalente a 2x a gravidade normal
            p.vy += (GRAVITY * 3) * dt; 
        }

        if (p.input.left) p.vx = -PLAYER_SPEED;
        else if (p.input.right) p.vx = PLAYER_SPEED;
        else p.vx = 0;

        if (p.input.jump && p.onGround) {
            p.vy = -JUMP_FORCE;
            p.onGround = false;
        }

        // --- INÍCIO DO BLOCO DE TIRO INSERIDO AQUI ---
        // Verifica se a propriedade existe (evita NaN)
        if (typeof p.shootCooldown !== 'number') {
            p.shootCooldown = 0;
        }

        p.shootCooldown -= dt; 

        if (p.input.shoot && p.shootCooldown <= 0) {
            p.shootCooldown = 0.3; // 300ms de cooldown

            const playerCenterX = p.x + p.width / 2;
            const playerCenterY = p.y + p.height / 2;

            const dx = p.input.aimX - playerCenterX;
            const dy = p.input.aimY - playerCenterY;
            
            const angle = Math.atan2(dy, dx);

            const bVx = Math.cos(angle) * BULLET_SPEED;
            const bVy = Math.sin(angle) * BULLET_SPEED;

            const bStartX = playerCenterX + Math.cos(angle) * 25;
            const bStartY = playerCenterY + Math.sin(angle) * 25;

            const bulletId = Date.now() + Math.random();

            const newBullet = createBullet(bulletId, p.id, bStartX, bStartY, bVx, bVy);
            gameState.bullets.push(newBullet);
        }
        // --- FIM DO BLOCO DE TIRO ---

        // B. Movimento em X e Colisão
        p.x += p.vx * dt;
        for (const plat of currentMap.platforms) {
            if (checkAABB(p, plat)) {
                // Se colidiu movendo para a direita
                if (p.vx > 0) p.x = plat.x - p.width;
                // Se colidiu movendo para a esquerda
                else if (p.vx < 0) p.x = plat.x + plat.w;
                p.vx = 0;
            }
        }

        // C. Movimento em Y e Colisão
        p.y += p.vy * dt;
        p.onGround = false; // Assume que está no ar até bater no chão

        for (const plat of currentMap.platforms) {
            if (checkAABB(p, plat)) {
                // Bateu a cabeça subindo
                if (p.vy < 0) {
                    p.y = plat.y + plat.h;
                    p.vy = 0;
                }
                // Pisou no chão caindo
                else if (p.vy > 0) {
                    p.y = plat.y - p.height;
                    p.vy = 0;
                    p.onGround = true;
                }
            }
        }

        // Trava os limites do mapa (não deixa cair no infinito)
        if (p.y > currentMap.height + 100) {
            p.alive = false;
            p.respawnTimer = RESPAWN_TIME;
            p.deaths++;
        }
    }

    // --- 2. ATUALIZA BALAS ---
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const b = gameState.bullets[i];
        
        // Move a bala
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Remove se saiu da tela
        if (b.x < 0 || b.x > currentMap.width || b.y < 0 || b.y > currentMap.height) {
        gameState.bullets.splice(i, 1);
        continue;
        }

        // Verifica colisão da bala com jogadores
        // Verifica colisão da bala com jogadores
        let hit = false;
        for (const id in gameState.players) {
            const target = gameState.players[id];
            
            // Ignora se o alvo está morto ou se foi quem atirou
            if (!target.alive || target.id === b.ownerId) continue;

            // Agora podemos passar o objeto da bala (b) e o do jogador (target) direto!
            if (checkAABB(b, target)) {
                // Matou o jogador
                target.alive = false;
                target.respawnTimer = RESPAWN_TIME;
                target.deaths++;
                
                // Pontua para quem atirou e atualiza o placar do time
                // Pontua para quem atirou e atualiza o placar do time
                if (gameState.players[b.ownerId]) {
                    const killer = gameState.players[b.ownerId]; 
                    
                    if (killer.team === target.team) {
                        // Traição! Desconta um ponto do time e tira uma kill do atirador
                        gameState.scores[killer.team]--;
                        killer.kills--; 
                    } else {
                        // Abate normal em um inimigo
                        killer.kills++;
                        gameState.scores[killer.team]++;
                    } // Soma o ponto no placar global!

                    // Agora a variável killer existe e tem nome e time!
                    gameState.killFeed.push({
                        killerName: killer.name,
                        killerTeam: killer.team,
                        victimName: target.name,
                        victimTeam: target.team,
                        timer: 4 
                    });

                    if (gameState.killFeed.length > 5) {
                        gameState.killFeed.shift();
                    }
                }

                gameState.bullets.splice(i, 1); // Remove a bala
                hit = true;
                break; // Sai do for dos jogadores
            }
        }

        if (hit) continue; // Pula para a próxima bala

        // Verifica colisão da bala com paredes (remove a bala se bater no cenário)
        for (const plat of currentMap.platforms) {
            // Agora passamos a bala (b) e a plataforma (plat) direto!
            if (checkAABB(b, plat)) {
                gameState.bullets.splice(i, 1);
                break; // Sai do for das plataformas
            }
        }
    }
}

module.exports = { updateGame };