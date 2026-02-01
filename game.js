const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 20;

const TILE = {
    GRASS: 0,
    TREE: 1,
    ROCK: 2,
    INN: 3
};

const RESPAWN_MS = {
    [TILE.TREE]: 15000,
    [TILE.ROCK]: 20000
};

const state = {
    map: [],
    resourceHP: new Map(),
    respawns: [],
    player: { x: 2, y: 2, dx: 1, dy: 0 },
    inventory: { wood: 0, stone: 0 },
    innLevel: 1,
    logs: []
};

const upgradeCosts = {
    2: { wood: 20, stone: 10 },
    3: { wood: 50, stone: 30 }
};

function keyFor(x, y) {
    return `${x},${y}`;
}

function logMessage(text) {
    state.logs.unshift(text);
    state.logs = state.logs.slice(0, 6);
    const logEl = document.getElementById('log');
    logEl.innerHTML = '';
    for (const line of state.logs) {
        const div = document.createElement('div');
        div.textContent = line;
        logEl.appendChild(div);
    }
}

function initMap() {
    state.map = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(TILE.GRASS));

    const innX = Math.floor(MAP_WIDTH / 2);
    const innY = Math.floor(MAP_HEIGHT / 2);
    state.map[innY][innX] = TILE.INN;

    placeResources(TILE.TREE, 35, innX, innY);
    placeResources(TILE.ROCK, 20, innX, innY);
}

function placeResources(type, count, innX, innY) {
    let placed = 0;
    while (placed < count) {
        const x = Math.floor(Math.random() * MAP_WIDTH);
        const y = Math.floor(Math.random() * MAP_HEIGHT);
        if (state.map[y][x] !== TILE.GRASS) continue;
        if (Math.abs(x - innX) + Math.abs(y - innY) < 2) continue;
        state.map[y][x] = type;
        state.resourceHP.set(keyFor(x, y), type === TILE.TREE ? 3 : 4);
        placed++;
    }
}

function isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return false;
    const tile = state.map[y][x];
    return tile === TILE.GRASS || tile === TILE.INN;
}

function movePlayer(dx, dy) {
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;
    state.player.dx = dx;
    state.player.dy = dy;
    if (isWalkable(nx, ny)) {
        state.player.x = nx;
        state.player.y = ny;
    }
    updateUpgradeUI();
}

function harvest() {
    const tx = state.player.x + state.player.dx;
    const ty = state.player.y + state.player.dy;
    if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return;

    const tile = state.map[ty][tx];
    if (tile !== TILE.TREE && tile !== TILE.ROCK) {
        logMessage('Nothing to harvest.');
        return;
    }

    const hpKey = keyFor(tx, ty);
    const hp = (state.resourceHP.get(hpKey) ?? 1) - 1;
    if (hp <= 0) {
        state.map[ty][tx] = TILE.GRASS;
        state.resourceHP.delete(hpKey);
        if (tile === TILE.TREE) state.inventory.wood += 1;
        if (tile === TILE.ROCK) state.inventory.stone += 1;
        state.respawns.push({ x: tx, y: ty, type: tile, at: Date.now() + RESPAWN_MS[tile] });
        logMessage(tile === TILE.TREE ? 'Chopped a tree (+1 wood).' : 'Cracked a rock (+1 stone).');
    } else {
        state.resourceHP.set(hpKey, hp);
        logMessage(tile === TILE.TREE ? 'Hit the tree.' : 'Hit the rock.');
    }

    updateInventoryUI();
}

function canUpgrade() {
    const nextLevel = state.innLevel + 1;
    const cost = upgradeCosts[nextLevel];
    if (!cost) return false;
    return state.inventory.wood >= cost.wood && state.inventory.stone >= cost.stone;
}

function isNearInn() {
    const innPos = findInn();
    const dist = Math.abs(state.player.x - innPos.x) + Math.abs(state.player.y - innPos.y);
    return dist === 1;
}

function upgradeInn() {
    const nextLevel = state.innLevel + 1;
    const cost = upgradeCosts[nextLevel];
    if (!cost) {
        logMessage('Inn is at max level.');
        return;
    }
    if (!isNearInn()) {
        logMessage('Move next to the inn to upgrade.');
        return;
    }
    if (!canUpgrade()) {
        logMessage('Not enough resources.');
        return;
    }

    state.inventory.wood -= cost.wood;
    state.inventory.stone -= cost.stone;
    state.innLevel = nextLevel;
    logMessage(`Inn upgraded to level ${state.innLevel}.`);
    updateInventoryUI();
    updateUpgradeUI();
}

function findInn() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (state.map[y][x] === TILE.INN) return { x, y };
        }
    }
    return { x: 0, y: 0 };
}

function updateInventoryUI() {
    document.getElementById('wood-count').textContent = state.inventory.wood;
    document.getElementById('stone-count').textContent = state.inventory.stone;
}

function updateUpgradeUI() {
    const levelEl = document.getElementById('inn-level');
    const costEl = document.getElementById('upgrade-cost');
    const btn = document.getElementById('upgrade-btn');
    levelEl.textContent = state.innLevel;

    const nextLevel = state.innLevel + 1;
    const cost = upgradeCosts[nextLevel];
    if (!cost) {
        costEl.textContent = 'Max level reached.';
        btn.disabled = true;
        return;
    }

    costEl.textContent = `Next: ${cost.wood} wood + ${cost.stone} stone`;
    btn.disabled = !(isNearInn() && canUpgrade());
}

function tickRespawns() {
    const now = Date.now();
    const remaining = [];
    for (const respawn of state.respawns) {
        if (now >= respawn.at) {
            if (state.map[respawn.y][respawn.x] === TILE.GRASS) {
                state.map[respawn.y][respawn.x] = respawn.type;
                state.resourceHP.set(keyFor(respawn.x, respawn.y), respawn.type === TILE.TREE ? 3 : 4);
            }
        } else {
            remaining.push(respawn);
        }
    }
    state.respawns = remaining;
}

function drawTile(x, y, tile) {
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;

    ctx.fillStyle = '#5aa469';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    if (tile === TILE.TREE) {
        ctx.fillStyle = '#2f6d3f';
        ctx.fillRect(px + 6, py + 4, TILE_SIZE - 12, TILE_SIZE - 8);
        ctx.fillStyle = '#5c3b1e';
        ctx.fillRect(px + 13, py + 18, 6, 10);
    }

    if (tile === TILE.ROCK) {
        ctx.fillStyle = '#7b7f87';
        ctx.beginPath();
        ctx.moveTo(px + 6, py + 22);
        ctx.lineTo(px + 12, py + 8);
        ctx.lineTo(px + 24, py + 12);
        ctx.lineTo(px + 26, py + 24);
        ctx.closePath();
        ctx.fill();
    }

    if (tile === TILE.INN) {
        ctx.fillStyle = '#c97a3d';
        ctx.fillRect(px + 4, py + 8, TILE_SIZE - 8, TILE_SIZE - 12);
        ctx.fillStyle = '#8d4f22';
        ctx.fillRect(px + 12, py + 14, 8, 14);
        ctx.fillStyle = '#f2d27a';
        ctx.fillRect(px + 8, py + 10, 6, 6);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
}

function drawPlayer() {
    const px = state.player.x * TILE_SIZE;
    const py = state.player.y * TILE_SIZE;
    ctx.fillStyle = '#4b9fea';
    ctx.fillRect(px + 8, py + 8, 16, 16);
    ctx.fillStyle = '#1b2b4a';
    ctx.fillRect(px + 12, py + 12, 4, 4);
    ctx.fillRect(px + 20, py + 12, 4, 4);

    const fx = (state.player.x + state.player.dx) * TILE_SIZE;
    const fy = (state.player.y + state.player.dy) * TILE_SIZE;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx + 2, fy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.lineWidth = 1;
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            drawTile(x, y, state.map[y][x]);
        }
    }
    drawPlayer();
}

function gameLoop() {
    tickRespawns();
    render();
    requestAnimationFrame(gameLoop);
}

function setupControls() {
    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();

        if (key === 'arrowup' || key === 'w') movePlayer(0, -1);
        if (key === 'arrowdown' || key === 's') movePlayer(0, 1);
        if (key === 'arrowleft' || key === 'a') movePlayer(-1, 0);
        if (key === 'arrowright' || key === 'd') movePlayer(1, 0);

        if (key === 'e') {
            if (!event.repeat) harvest();
        }
        if (key === 'f') {
            if (!event.repeat) upgradeInn();
        }
    });

    const upgradeBtn = document.getElementById('upgrade-btn');
    upgradeBtn.addEventListener('click', upgradeInn);
}

function init() {
    initMap();
    setupControls();
    updateInventoryUI();
    updateUpgradeUI();
    logMessage('Welcome to Adventurers Inn.');
    gameLoop();
}

init();
