// src/maps.js
const maps = [
    {
        name: "Arena",
        width: 1600,
        height: 1200,
        platforms: [
            { x: 0, y: 1150, w: 1600, h: 50 },      // Chão
            { x: 200, y: 950, w: 300, h: 20 },      // Plataformas baixas laterais
            { x: 1100, y: 950, w: 300, h: 20 },
            { x: 650, y: 750, w: 300, h: 20 },      // Plataforma central média
            { x: 300, y: 550, w: 200, h: 20 },      // Plataformas altas
            { x: 1100, y: 550, w: 200, h: 20 }
        ],
        spawnPoints: {
            0: [{ x: 100, y: 1000 }, { x: 200, y: 1000 }],
            1: [{ x: 1400, y: 1000 }, { x: 1300, y: 1000 }]
        }
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
        spawnPoints: {
            0: [{ x: 100, y: 600 }, { x: 200, y: 600 }],
            1: [{ x: 1400, y: 600 }, { x: 1300, y: 600 }]
        }
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
        spawnPoints: {
            0: [{ x: 100, y: 1000 }, { x: 250, y: 800 }],
            1: [{ x: 1400, y: 1000 }, { x: 1250, y: 800 }]
        }
    }
];

module.exports = maps;