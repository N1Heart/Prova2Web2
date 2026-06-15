const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- IMPORTAÇÕES DO JOGO ---
const { TICK_RATE } = require('./src/constants');
const maps = require('./src/maps');
const { createGameState, createPlayer, createBullet } = require('./src/entities');
const { updateGame } = require('./src/gameLoop');

const PORT = 3000;
const MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// --- ESTADO GLOBAL E CLIENTES ---
const gameState = createGameState();
const clients = new Map(); // Mapeia o 'socket' para o 'playerId'
let nextPlayerId = 1;

function ipPlacaRede() {
    const nets = os.networkInterfaces();
    for (const nome of Object.keys(nets)) {
        for (const net of nets[nome] ?? []) {
            const ipv4 = net.family === "IPv4" || net.family === 4;
            if (ipv4 && !net.internal) {
                return net.address;
            }
        }
    }
    return "127.0.0.1";
}

// --- FUNÇÕES DE FRAME WEBSOCKET ---
function parseFrame(buffer) {
    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
        payloadLength = buffer.readUInt16BE(offset);
        offset += 2;
    } else if (payloadLength === 127) {
        payloadLength = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
    }

    let maskKey = null;
    if (isMasked) {
        maskKey = buffer.subarray(offset, offset + 4);
        offset += 4;
    }

    const payload = Buffer.alloc(payloadLength);
    for (let i = 0; i < payloadLength; i++) {
        payload[i] = buffer[offset + i] ^ maskKey[i % 4];
    }
    return { opcode, payload };
}

function buildFrame(data) {
    const payload = Buffer.from(data);
    const payloadLength = payload.length;
    let header;
    
    if (payloadLength <= 125) {
        header = Buffer.alloc(2);
        header[1] = payloadLength;
    } else if (payloadLength <= 65535) {
        header = Buffer.alloc(4);
        header[1] = 126;
        header.writeUInt16BE(payloadLength, 2);
    } else {
        header = Buffer.alloc(10);
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(payloadLength), 2);
    }

    header[0] = 0x81; // FIN = 1, Opcode = 1 (Texto)
    return Buffer.concat([header, payload]);
}

// Auxiliares de envio JSON
function sendJson(socket, obj) {
    socket.write(buildFrame(JSON.stringify(obj)));
}

function broadcast(obj) {
    const frame = buildFrame(JSON.stringify(obj));
    for (const socket of clients.keys()) {
        socket.write(frame);
    }
}

// --- SERVIDOR HTTP ---
// --- SERVIDOR HTTP ---
const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
    }

    // Se a URL for '/', carrega o index.html. Se não, usa a URL pedida (ex: '/style.css')
    let filePath = req.url === '/' ? '/index.html' : req.url;
    
    // Junta com o diretório atual e a pasta 'public'
    filePath = path.join(__dirname, 'public', filePath);

    // Pega a extensão do arquivo para dizer ao navegador o que estamos enviando
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Lê o arquivo e envia
    fs.readFile(filePath, (err, content) => {
        if (err) {
            // Se o arquivo não existir na pasta public, devolve 404
            res.writeHead(404);
            res.end('Not found');
        } else {
            // Devolve o arquivo com sucesso
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// --- GAME LOOP ---
const tickIntervalMs = 1000 / TICK_RATE;
let lastTime = Date.now();

setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // 1. Roda a física
    updateGame(gameState, dt);

    // 2. Envia o estado atualizado para todo mundo conectado
    if (clients.size > 0) {
        broadcast({
            type: 'state',
            mapIndex: gameState.currentMapIndex,
            nextMapIndex: gameState.nextMapIndex,
            players: gameState.players,
            bullets: gameState.bullets,
            scores: gameState.scores,
            matchTime: gameState.matchTime,
            isEnded: gameState.isEnded,
            winner: gameState.winner,
            killFeed: gameState.killFeed
        });
    }
}, tickIntervalMs);

// --- HANDSHAKE E MENSAGENS WEBSOCKET ---
server.on('upgrade', (req, socket) => {
    if (req.headers['upgrade']?.toLowerCase() !== 'websocket') {
        socket.end('HTTP/1.1 400 Bad Request');
        return;
    }

    const clientKey = req.headers['sec-websocket-key'];
    const acceptKey = crypto.createHash('sha1').update(clientKey + MAGIC_STRING).digest('base64');

    const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`
    ];
    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

    // Lógica de lidar com o jogador desconectando
    function handleDisconnect() {
        const playerId = clients.get(socket);
        if (playerId) {
            delete gameState.players[playerId];
            clients.delete(socket);
            console.log(`Jogador ${playerId} desconectou.`);
        }
        socket.end();
    }

    socket.on('data', (buffer) => {
        try {
            const frame = parseFrame(buffer);
            
            // Cliente fechou a conexão
            if (frame.opcode === 0x8) {
                return handleDisconnect();
            }

            // Cliente mandou uma mensagem de texto (JSON)
            if (frame.opcode === 0x1) {
                const message = frame.payload.toString('utf8');
                const data = JSON.parse(message);

                // NOVO JOGADOR ENTRANDO
                if (data.type === 'join') {
                    const playerId = nextPlayerId++;
                    clients.set(socket, playerId);

                    // Atribui time alternadamente (par = Azul, ímpar = Vermelho)
                    const team = playerId % 2 === 0 ? 1 : 0;
                    const spawn = maps[gameState.currentMapIndex].spawnPoints[team][0];

                    const player = createPlayer(playerId, data.name, team, spawn.x, spawn.y);
                    gameState.players[playerId] = player;

                    // Avisa ao cliente o ID dele
                    sendJson(socket, {
                        type: 'init',
                        playerId: playerId,
                        mapIndex: gameState.currentMapIndex,
                        teams: { RED: 0, BLUE: 1 }
                    });
                    console.log(`Jogador '${data.name}' entrou (ID: ${playerId})`);
                }

                // COMANDOS DE MOVIMENTO DO JOGADOR
                if (data.type === 'input') {
                    const playerId = clients.get(socket);
                    if (playerId && gameState.players[playerId]) {
                        gameState.players[playerId].input = {
                            left: data.left,
                            right: data.right,
                            jump: data.jump,
                            down: data.down,
                            shoot: data.shoot,
                            aimX: data.aimX,
                            aimY: data.aimY
                        };
                    }
                }
            }
        } catch (error) {
            // Se o JSON vier quebrado, só ignora para não derrubar o servidor
        }
    });
    
    socket.on('error', handleDisconnect);
    socket.on('close', handleDisconnect);
});

const host = ipPlacaRede();
server.listen(PORT, () => {
    console.log(`Combat rodando em : ${host}:${PORT}`);
})
