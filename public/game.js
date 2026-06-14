// public/game.js

// --- CONFIGURAÇÕES E ESTADO LOCAL ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const loginScreen = document.getElementById('login-screen');
const nameInput = document.getElementById('player-name');
const joinBtn = document.getElementById('join-btn');

let ws;
let myId = null;
let currentMapIndex = 0;
let lastState = null;

let camX = 0;
let camY = 0;
let mouseX = 0;
let mouseY = 0;
let showScoreboard = false;

const bgm = new Audio('musica_fundo.mp3');
bgm.loop = true;      // Faz a música reiniciar sozinha quando acabar
bgm.volume = 0.2;     // Volume mais baixo para não estourar

const jumpSound = new Audio('som_pulo.mp3');
jumpSound.volume = 0.4;

const shootSound = new Audio('som_tiro.mp3');
shootSound.volume = 0.3;

// Guarda os IDs das balas que já tocaram som para não repetir no loop
let audioBulletsTracked = new Set();


// Os mesmos mapas do servidor (para o cliente poder desenhar o cenário)
const maps = [
{
        name: "Arena",
        width: 1600,
        height: 1200,
        platforms: [
            { x: 0, y: 1150, w: 1600, h: 50 },
            { x: 200, y: 950, w: 300, h: 20 },
            { x: 1100, y: 950, w: 300, h: 20 },
            { x: 650, y: 750, w: 300, h: 20 },
            { x: 300, y: 550, w: 200, h: 20 },
            { x: 1100, y: 550, w: 200, h: 20 }
        ]
    },
    {
        name: "Pontes",
        width: 1600,
        height: 1200,
        platforms: [
            { x: 0, y: 1150, w: 1600, h: 50 },      // Chão (fosso da morte)
            { x: 0, y: 700, w: 500, h: 20 },        // Ponte enorme esquerda
            { x: 1100, y: 700, w: 500, h: 20 },     // Ponte enorme direita
            { x: 650, y: 900, w: 300, h: 20 },      // Ponte salva-vidas no fundo
            { x: 600, y: 500, w: 400, h: 20 }       // Ponte superior central
        ],
    },
    {
        name: "Castelo",
        width: 1600,
        height: 1200,
        platforms: [
            { x: 0, y: 1150, w: 1600, h: 50 },      // Chão térreo
            { x: 150, y: 950, w: 200, h: 20 },      // Escadaria esquerda
            { x: 300, y: 750, w: 200, h: 20 },
            { x: 1250, y: 950, w: 200, h: 20 },     // Escadaria direita
            { x: 1100, y: 750, w: 200, h: 20 },
            { x: 500, y: 550, w: 600, h: 20 },      // Salão principal do topo
            { x: 700, y: 350, w: 200, h: 20 }       // Trono (ponto mais alto)
        ],
    }
    // Adicione os outros mapas aqui conforme fez no servidor
];

// Estado dos inputs do jogador local
const input = { left: false, right: false, jump: false, down: false, shoot: false, aimX: 0, aimY: 0 };

// --- CONEXÃO E WEBSOCKET ---
joinBtn.addEventListener('click', () => {
    const playerName = nameInput.value.trim() || 'Jogador';
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().then(() => {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(err => console.log("Rotação não suportada nativamente.", err));
            }
        }).catch(err => console.log("Fullscreen bloqueado.", err));
    }
    
    bgm.play().catch(error => {
        console.log("Erro ao tentar tocar a música:", error);
    });
    // Conecta ao servidor WebSocket
   // Conecta ao servidor WebSocket (Ajusta automaticamente para WSS se estiver em HTTPS)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    ws = new WebSocket(`${wsProtocol}${window.location.host}`);

    ws.onopen = () => {
        // Esconde login e mostra o jogo
        loginScreen.style.display = 'none';
        canvas.style.display = 'block';

        bgm.play().catch(error => {
            console.log("Navegador bloqueou o áudio inicialmente:", error);
        });
        // Envia pedido para entrar
        ws.send(JSON.stringify({ type: 'join', name: playerName }));
        
        // Inicia o loop de renderização e de envio de input
        requestAnimationFrame(render);
        setInterval(sendInput, 1000 / 60); // Envia input a ~60Hz
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'init') {
            myId = data.playerId;
            currentMapIndex = data.mapIndex || 0;
        }

        if (data.type === 'state') {
            lastState = data; // Salva o estado mais recente recebido do servidor
            currentMapIndex = data.mapIndex;

            if (data.bullets) {
                for (const b of data.bullets) {
                    // Se o servidor mandou uma bala com ID que o cliente ainda não conhece...
                    if (!audioBulletsTracked.has(b.id)) {
                        
                        // Técnica cloneNode(): Permite tocar múltiplos tiros idênticos
                        // sobrepostos sem cortar o som do tiro anterior que ainda está tocando
                        const shotClone = shootSound.cloneNode();
                        shotClone.volume = shootSound.volume;
                        shotClone.play().catch(() => {});

                        // Registra que essa bala já fez barulho
                        audioBulletsTracked.add(b.id);
                    }
                }

                // Limpeza: Remove do Set as balas antigas que já sumiram do servidor
                const serverBulletIds = new Set(data.bullets.map(b => b.id));
                for (const id of audioBulletsTracked) {
                    if (!serverBulletIds.has(id)) {
                        audioBulletsTracked.delete(id);
                    }
                }
            }
        }
    };

    ws.onclose = () => {
        alert('Conexão perdida com o servidor.');
        window.location.reload();
    };
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
        e.preventDefault(); // Evita que o navegador mude de aba/foco
        showScoreboard = true;
    }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') input.jump = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') input.down = true;
});

window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Tab') {
        e.preventDefault();
        showScoreboard = false;
    }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') input.jump = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') input.down = false; // <-- NOVA LINHA
});

// --- CAPTURA DE INPUT ---
window.addEventListener('keydown', (e) => {

    if (e.repeat) return;

    if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {input.jump = true;
        jumpSound.currentTime = 0; 
            jumpSound.play().catch(() => {});
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') input.jump = false;
});


canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.shoot = true; // Clique esquerdo
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.shoot = false;
});
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

// Envia o input atual para o servidor
function sendInput() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        // A mira precisa ser convertida de coordenada da tela para coordenada do mundo!
        input.aimX = mouseX + camX;
        input.aimY = mouseY + camY;
        ws.send(JSON.stringify({ type: 'input', ...input }));
    }
}
// --- CONTROLES MOBILE (TOUCH) ---

// 1. Mapear os botões virtuais
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnJump = document.getElementById('btn-jump');
const btnDown = document.getElementById('btn-down');

// Função auxiliar para aplicar eventos sem duplicar código
function bindTouch(element, inputKey) {
    if(!element) return;
    
    element.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Impede scroll
        e.stopPropagation(); // Impede que o toque vaze para o Canvas (tiro)
        input[inputKey] = true;
        
        // Se for o pulo, toca o som igual no PC!
        if (inputKey === 'jump') {
            jumpSound.currentTime = 0; 
            jumpSound.play().catch(() => {});
        }
    }, { passive: false });

    element.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        input[inputKey] = false;
    }, { passive: false });
}

bindTouch(btnLeft, 'left');
bindTouch(btnRight, 'right');
bindTouch(btnJump, 'jump');
bindTouch(btnDown, 'down');

// 2. Tiro ao tocar no Canvas
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Evita dar zoom
    const touch = e.changedTouches[0]; // Pega o primeiro dedo que tocou na tela
    const rect = canvas.getBoundingClientRect();
    
    // Descobre a coordenada X e Y exata daquele ponto no celular
    // multiplicando pela escala (canvas.width / rect.width) para alinhar perfeitamente
    mouseX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (touch.clientY - rect.top) * (canvas.height / rect.height);
    
    input.shoot = true;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    
    mouseX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (touch.clientY - rect.top) * (canvas.height / rect.height);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    input.shoot = false;
}, { passive: false });

// --- LOOP DE RENDERIZAÇÃO ---
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!lastState) {
        requestAnimationFrame(render);
        return;
    }

    const currentMap = maps[currentMapIndex];
    const myPlayer = lastState.players[myId];

    // --- CÁLCULO DA CÂMERA ---
    if (myPlayer && currentMap) {
        // Centraliza a câmera no jogador local
        camX = myPlayer.x + myPlayer.width / 2 - canvas.width / 2;
        camY = myPlayer.y + myPlayer.height / 2 - canvas.height / 2;

        // Trava a câmera para não mostrar áreas além do mapa
        camX = Math.max(0, Math.min(camX, currentMap.width - canvas.width));
        camY = Math.max(0, Math.min(camY, currentMap.height - canvas.height));
    }

    ctx.save(); // Salva o estado do canvas antes de mover
    ctx.translate(-camX, -camY); // Desloca a "viewport"

    // 1. Desenha o mapa
    ctx.fillStyle = '#16213e';
    ctx.strokeStyle = '#0f3460';
    ctx.lineWidth = 2;
    if (currentMap) {
        for (const plat of currentMap.platforms) {
            ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
            ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        }
    }

    // 2. Desenha os Jogadores
    for (const id in lastState.players) {
        const p = lastState.players[id];
        if (!p.alive) continue;

        ctx.fillStyle = p.team === 0 ? '#e94560' : '#0f3460';
        if (Number(id) === myId) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x, p.y, p.width, p.height);
        }
        ctx.fillRect(p.x, p.y, p.width, p.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x + p.width / 2, p.y - 10);
    }

    // 3. Desenha as Balas
    ctx.fillStyle = '#f5a623';
    for (const b of lastState.bullets) {
        ctx.fillRect(b.x, b.y, b.width, b.height);
    }

    ctx.restore(); // Restaura a câmera! A partir daqui, desenhamos relativo à tela fixa.

    // 4. Desenha o HUD (Placar e Tempo)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 800, 40);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    
    ctx.textAlign = 'left';
    ctx.fillText(`VERMELHOS: ${lastState.scores[0]}`, 20, 28);
    
    ctx.textAlign = 'right';
    ctx.fillText(`AZUIS: ${lastState.scores[1]}`, 780, 28);

    // Formata e desenha o tempo no centro
    const minutes = Math.floor(lastState.matchTime / 60);
    const seconds = Math.floor(lastState.matchTime % 60).toString().padStart(2, '0');
    
    ctx.textAlign = 'center';
    ctx.fillStyle = lastState.matchTime <= 10 ? '#e94560' : '#ffffff'; // Fica vermelho no fim
    ctx.fillText(`${minutes}:${seconds}`, 400, 28);

    // ... (depois do ctx.fillText do tempo no HUD)
    ctx.textAlign = 'center';
    ctx.fillStyle = lastState.matchTime <= 10 ? '#e94560' : '#ffffff';
    ctx.fillText(`${minutes}:${seconds}`, 400, 28);

    // --- NOVO: DESENHA O KILL FEED ---
    if (lastState.killFeed && lastState.killFeed.length > 0) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 14px Arial';
        
        // Desenha de baixo para cima
        let feedY = 60; 
        for (const kill of lastState.killFeed) {
            // Desenha nome de quem morreu (com a cor do time)
            ctx.fillStyle = kill.victimTeam === 0 ? '#e94560' : '#4e8dff';
            ctx.fillText(kill.victimName, 780, feedY);
            
            // Desenha um ícone/texto de arma
            const victimWidth = ctx.measureText(kill.victimName).width;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(" 🔫 ", 780 - victimWidth, feedY);
            
            // Desenha nome de quem matou
            const iconWidth = ctx.measureText(" 🔫 ").width;
            ctx.fillStyle = kill.killerTeam === 0 ? '#e94560' : '#4e8dff';
            ctx.fillText(kill.killerName, 780 - victimWidth - iconWidth, feedY);
            
            feedY += 25; // Desce o espaço para a próxima linha
        }
    }

    if (showScoreboard && lastState) {
        // 1. Fundo escuro transparente
        ctx.fillStyle = 'rgba(10, 15, 30, 0.9)';
        ctx.fillRect(100, 100, 600, 400);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(100, 100, 600, 400);

        // 2. Título Central
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("PLACAR DA PARTIDA", 400, 140);

        // 3. Separar os jogadores por equipa e ordená-los por abates (Kills)
        const redTeam = [];
        const blueTeam = [];

        for (const id in lastState.players) {
            const p = lastState.players[id];
            if (p.team === 0) redTeam.push(p);
            else blueTeam.push(p);
        }

        // Ordena do maior número de kills para o menor
        redTeam.sort((a, b) => b.kills - a.kills);
        blueTeam.sort((a, b) => b.kills - a.kills);

        // 4. Cabeçalhos das Equipas
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#e94560'; // Vermelho
        ctx.fillText("EQUIPE VERMELHA", 250, 180);
        
        ctx.fillStyle = '#4e8dff'; // Azul
        ctx.fillText("EQUIPE AZUL", 550, 180);

        // Sub-cabeçalhos (Nome, Kills / Deaths)
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText("NOME", 120, 210);
        ctx.fillText("K / D", 340, 210);
        
        ctx.fillText("NOME", 420, 210);
        ctx.fillText("K / D", 640, 210);

        // Linha divisória
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(120, 220);
        ctx.lineTo(680, 220);
        ctx.stroke();

        // 5. Desenhar Lista Vermelha
        ctx.font = '15px Arial';
        let yRed = 245;
        for (const p of redTeam) {
            // Se for o próprio jogador local, desenha em branco para destacar
            ctx.fillStyle = p.id === myId ? '#ffffff' : '#cccccc';
            ctx.textAlign = 'left';
            ctx.fillText(p.name, 120, yRed);
            ctx.fillText(`${p.kills} / ${p.deaths}`, 340, yRed);
            yRed += 25;
        }

        // 6. Desenhar Lista Azul
        let yBlue = 245;
        for (const p of blueTeam) {
            ctx.fillStyle = p.id === myId ? '#ffffff' : '#cccccc';
            ctx.textAlign = 'left';
            ctx.fillText(p.name, 420, yBlue);
            ctx.fillText(`${p.kills} / ${p.deaths}`, 640, yBlue);
            yBlue += 25;
        }
    }

    if (lastState.isEnded) {
        // 1. Escurece o fundo do jogo inteiro
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Desenha a caixinha central do Popup
        const boxW = 450;
        const boxH = 250;
        const boxX = canvas.width / 2 - boxW / 2;
        const boxY = canvas.height / 2 - boxH / 2;

        ctx.fillStyle = '#16213e';
        ctx.strokeStyle = '#e94560'; // Borda vermelha estilosa
        ctx.lineWidth = 4;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // 3. Texto do Vencedor
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        
        let titleText = "FIM DE PARTIDA!";
        if (lastState.winner === 'RED') {
            ctx.fillStyle = '#e94560';
            titleText = "VITÓRIA DOS VERMELHOS!";
        } else if (lastState.winner === 'BLUE') {
            ctx.fillStyle = '#4e8dff'; // Um azul mais claro pro texto destacar
            titleText = "VITÓRIA DOS AZUIS!";
        } else {
            ctx.fillStyle = '#ffffff';
            titleText = "EMPATE!";
        }
        ctx.fillText(titleText, canvas.width / 2, canvas.height / 2 - 40);

        // 4. Placar Final Grande
        ctx.fillStyle = '#888888';
        ctx.font = '14px Arial';
        ctx.fillText("PLACAR FINAL", canvas.width / 2, canvas.height / 2 + 5);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px Arial';
        ctx.fillText(`${lastState.scores[0]}  -  ${lastState.scores[1]}`, canvas.width / 2, canvas.height / 2 + 50);

        // 5. Mensagem de carregamento
        ctx.fillStyle = '#aaaaaa';
        ctx.font = 'italic 14px Arial';
        ctx.fillText("Preparando próxima arena...", canvas.width / 2, canvas.height / 2 + 95);
    }

    requestAnimationFrame(render);
}