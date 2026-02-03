import spriteUrl from './assets/character_sheet.png.png';

export type UiSnapshot = {
  wood: number;
  stone: number;
  innLevel: number;
  logs: string[];
  clock: {
    day: number;
    time: string;
    weather: string;
  };
  stats: {
    gold: number;
    hpPct: number;
    hpText: number;
    stamPct: number;
    stamText: number;
  };
  upgradeCostText: string;
  sellRatesText: string;
  canUpgrade: boolean;
  canSell: boolean;
};

export const defaultUi: UiSnapshot = {
  wood: 0,
  stone: 0,
  innLevel: 1,
  logs: [],
  clock: {
    day: 1,
    time: '6:00 AM',
    weather: 'Clear'
  },
  stats: {
    gold: 0,
    hpPct: 100,
    hpText: 100,
    stamPct: 100,
    stamText: 100
  },
  upgradeCostText: 'Next: 20 wood + 10 stone',
  sellRatesText: 'Sell: 2g wood, 3g stone',
  canUpgrade: false,
  canSell: false
};

export type GameApi = {
  upgradeInn: () => void;
  sellResources: () => void;
  destroy: () => void;
};

const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 20;
const BASE_WIDTH = MAP_WIDTH * TILE_SIZE;
const BASE_HEIGHT = MAP_HEIGHT * TILE_SIZE;
const SPRITE_SIZE = 24;
const SHEET_COLS = 5;
const SHEET_ROWS = 4;
const MOVE_FRAMES = 3;
const HARVEST_FRAMES = 3;
const MOVE_FRAME_MS = 120;
const HARVEST_FRAME_MS = 140;
const HARVEST_DURATION_MS = HARVEST_FRAME_MS * HARVEST_FRAMES;

const TILE = {
  GRASS: 0,
  TREE: 1,
  ROCK: 2,
  INN: 3
} as const;

type TileType = (typeof TILE)[keyof typeof TILE];

type Player = { x: number; y: number; dx: number; dy: number };

type State = {
  map: TileType[][];
  resourceHP: Map<string, number>;
  respawns: { x: number; y: number; type: TileType; at: number }[];
  player: Player;
  inventory: { wood: number; stone: number };
  innLevel: number;
  logs: string[];
  clock: { day: number; minutes: number; weather: string; accMs: number };
  lastTick: number | null;
  now: number;
  stats: { gold: number; hp: number; maxHp: number; stam: number; maxStam: number };
  lastMoveAt: number;
  move: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    startedAt: number;
    duration: number;
    active: boolean;
  };
  harvestAnim: null | {
    x: number;
    y: number;
    type: TileType;
    startedAt: number;
  };
};

const RESPAWN_MS: Record<TileType, number> = {
  [TILE.GRASS]: 0,
  [TILE.TREE]: 15000,
  [TILE.ROCK]: 20000,
  [TILE.INN]: 0
};

const upgradeCosts: Record<number, { wood: number; stone: number } | undefined> = {
  2: { wood: 20, stone: 10 },
  3: { wood: 50, stone: 30 }
};

const sellPrices = {
  wood: 2,
  stone: 3
};

function keyFor(x: number, y: number) {
  return `${x},${y}`;
}

function formatTime(minutes: number) {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = String(minute).padStart(2, '0');
  return `${displayHour}:${displayMinute} ${suffix}`;
}

function tileRand(x: number, y: number, seed: number) {
  const value = Math.sin((x * 127.1 + y * 311.7 + seed * 101.3) * 0.017);
  return value - Math.floor(value);
}

const MOVE_FRAMES_MAP = {
  down: { row: 0, cols: [0, 1, 2], flip: false },
  left: { row: 1, cols: [0, 1, 2], flip: false },
  right: { row: 1, cols: [0, 1, 2], flip: true },
  up: { row: 1, cols: [2, 3, 4], flip: false }
} as const;

const HARVEST_FRAMES_MAP = {
  rock: { row: 2, cols: [0, 1, 2] },
  wood: { row: 3, cols: [0, 1, 2] }
} as const;

function spriteFrame(col: number, row: number, frameW: number, frameH: number) {
  const safeCol = Math.max(0, Math.min(SHEET_COLS - 1, col));
  const safeRow = Math.max(0, Math.min(SHEET_ROWS - 1, row));
  return {
    sx: Math.floor(safeCol * frameW),
    sy: Math.floor(safeRow * frameH)
  };
}

export function createGame(
  canvas: HTMLCanvasElement,
  onUiUpdate: (ui: UiSnapshot) => void
): GameApi {
  const maybeCtx = canvas.getContext('2d');
  if (!maybeCtx) throw new Error('Canvas 2D context not available.');
  const ctx = maybeCtx;

  const state: State = {
    map: [],
    resourceHP: new Map(),
    respawns: [],
    player: { x: 2, y: 2, dx: 1, dy: 0 },
    inventory: { wood: 0, stone: 0 },
    innLevel: 1,
    logs: [],
    clock: { day: 1, minutes: 6 * 60, weather: 'Clear', accMs: 0 },
    lastTick: null,
    now: 0,
    stats: { gold: 0, hp: 100, maxHp: 100, stam: 100, maxStam: 100 },
    lastMoveAt: 0,
    move: {
      fromX: 2,
      fromY: 2,
      toX: 2,
      toY: 2,
      startedAt: 0,
      duration: 140,
      active: false
    },
    harvestAnim: null
  };

  let rafId = 0;
  let spriteReady = false;
  const sprite = new Image();
  sprite.src = spriteUrl;
  sprite.onload = () => {
    spriteReady = true;
  };

  function logMessage(text: string) {
    state.logs.unshift(text);
    state.logs = state.logs.slice(0, 6);
    emitUi();
  }

  function emitUi() {
    const nextLevel = state.innLevel + 1;
    const cost = upgradeCosts[nextLevel];
    const canUpgrade =
      !!cost &&
      isNearInn() &&
      state.inventory.wood >= cost.wood &&
      state.inventory.stone >= cost.stone;
    const canSell = isNearInn() && (state.inventory.wood > 0 || state.inventory.stone > 0);
    const hpPct = Math.round((state.stats.hp / state.stats.maxHp) * 100);
    const stamPct = Math.round((state.stats.stam / state.stats.maxStam) * 100);

    onUiUpdate({
      wood: state.inventory.wood,
      stone: state.inventory.stone,
      innLevel: state.innLevel,
      logs: [...state.logs],
      clock: {
        day: state.clock.day,
        time: formatTime(state.clock.minutes),
        weather: state.clock.weather
      },
      stats: {
        gold: state.stats.gold,
        hpPct: Math.max(0, Math.min(100, hpPct)),
        hpText: Math.round(state.stats.hp),
        stamPct: Math.max(0, Math.min(100, stamPct)),
        stamText: Math.round(state.stats.stam)
      },
      upgradeCostText: cost ? `Next: ${cost.wood} wood + ${cost.stone} stone` : 'Max level reached.',
      sellRatesText: `Sell: ${sellPrices.wood}g wood, ${sellPrices.stone}g stone`,
      canUpgrade,
      canSell
    });
  }

  function initMap() {
    state.map = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(TILE.GRASS));

    const innX = Math.floor(MAP_WIDTH / 2);
    const innY = Math.floor(MAP_HEIGHT / 2);
    state.map[innY][innX] = TILE.INN;

    placeResources(TILE.TREE, 35, innX, innY);
    placeResources(TILE.ROCK, 20, innX, innY);
  }

  function placeResources(type: TileType, count: number, innX: number, innY: number) {
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

  function isWalkable(x: number, y: number) {
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return false;
    const tile = state.map[y][x];
    return tile === TILE.GRASS || tile === TILE.INN;
  }

  function movePlayer(dx: number, dy: number) {
    if (state.move.active) return;
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;
    state.player.dx = dx;
    state.player.dy = dy;
    if (isWalkable(nx, ny)) {
      state.move = {
        fromX: state.player.x,
        fromY: state.player.y,
        toX: nx,
        toY: ny,
        startedAt: state.now,
        duration: 140,
        active: true
      };
      state.lastMoveAt = state.now;
    }
    emitUi();
  }

  function harvest() {
    if (state.move.active) return;
    const tx = state.player.x + state.player.dx;
    const ty = state.player.y + state.player.dy;
    if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return;

    const tile = state.map[ty][tx];
    if (tile !== TILE.TREE && tile !== TILE.ROCK) {
      logMessage('Nothing to harvest.');
      return;
    }

    state.harvestAnim = {
      x: tx,
      y: ty,
      type: tile,
      startedAt: state.now
    };

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

    emitUi();
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
    if (state.inventory.wood < cost.wood || state.inventory.stone < cost.stone) {
      logMessage('Not enough resources.');
      return;
    }

    state.inventory.wood -= cost.wood;
    state.inventory.stone -= cost.stone;
    state.innLevel = nextLevel;
    logMessage(`Inn upgraded to level ${state.innLevel}.`);
    emitUi();
  }

  function sellResources() {
    if (!isNearInn()) {
      logMessage('Move next to the inn to sell.');
      return;
    }
    const wood = state.inventory.wood;
    const stone = state.inventory.stone;
    if (wood === 0 && stone === 0) {
      logMessage('No resources to sell.');
      return;
    }
    const gold = wood * sellPrices.wood + stone * sellPrices.stone;
    state.inventory.wood = 0;
    state.inventory.stone = 0;
    state.stats.gold += gold;
    logMessage(`Sold resources for ${gold} gold.`);
    emitUi();
  }

  function findInn() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (state.map[y][x] === TILE.INN) return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }

  function tickRespawns() {
    const now = Date.now();
    const remaining = [] as State['respawns'];
    for (const respawn of state.respawns) {
      if (now >= respawn.at) {
        if (state.map[respawn.y][respawn.x] === TILE.GRASS) {
          state.map[respawn.y][respawn.x] = respawn.type;
          state.resourceHP.set(
            keyFor(respawn.x, respawn.y),
            respawn.type === TILE.TREE ? 3 : 4
          );
        }
      } else {
        remaining.push(respawn);
      }
    }
    state.respawns = remaining;
  }

  function tickClock(deltaMs: number) {
    const minutesPerMs = 10 / 1000;
    state.clock.accMs += deltaMs;
    const deltaMinutes = Math.floor(state.clock.accMs * minutesPerMs);
    if (deltaMinutes <= 0) return;
    state.clock.accMs -= deltaMinutes / minutesPerMs;
    state.clock.minutes += deltaMinutes;
    if (state.clock.minutes >= 24 * 60) {
      state.clock.minutes -= 24 * 60;
      state.clock.day += 1;
    }
    emitUi();
  }

  function drawTile(x: number, y: number, tile: TileType) {
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;

    ctx.fillStyle = '#7fbf72';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#6aa35d';
    for (let i = 0; i < 3; i += 1) {
      const rx = Math.floor(tileRand(x, y, i + 1) * 26);
      const ry = Math.floor(tileRand(x, y, i + 9) * 26);
      if ((rx + ry) % 7 === 0) ctx.fillRect(px + 3 + rx, py + 3 + ry, 2, 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);

    if (
      state.harvestAnim &&
      state.harvestAnim.x === x &&
      state.harvestAnim.y === y &&
      (tile === TILE.TREE || tile === TILE.ROCK)
    ) {
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      return;
    }

    if (tile === TILE.TREE) {
      ctx.fillStyle = '#275a34';
      ctx.fillRect(px + 7, py + 6, 18, 14);
      ctx.fillStyle = '#2f6d3f';
      ctx.fillRect(px + 5, py + 4, 22, 14);
      ctx.fillStyle = '#4f8f4b';
      ctx.fillRect(px + 9, py + 6, 12, 8);
      ctx.fillStyle = '#6c3f1d';
      ctx.fillRect(px + 14, py + 18, 4, 10);
      ctx.fillStyle = '#3f2511';
      ctx.fillRect(px + 14, py + 22, 4, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(px + 10, py + 26, 12, 2);
    }

    if (tile === TILE.ROCK) {
      ctx.fillStyle = '#a3a8b0';
      ctx.fillRect(px + 7, py + 12, 18, 12);
      ctx.fillStyle = '#8c9198';
      ctx.fillRect(px + 5, py + 14, 20, 10);
      ctx.fillStyle = '#c2c6cc';
      ctx.fillRect(px + 9, py + 14, 6, 4);
      ctx.fillStyle = '#6f747b';
      ctx.fillRect(px + 18, py + 18, 4, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(px + 8, py + 24, 16, 2);
    }

    if (tile === TILE.INN) {
      ctx.fillStyle = '#b8562e';
      ctx.fillRect(px + 4, py + 6, TILE_SIZE - 8, 8);
      ctx.fillStyle = '#d97c3f';
      ctx.fillRect(px + 5, py + 8, TILE_SIZE - 10, 6);
      ctx.fillStyle = '#c97a3d';
      ctx.fillRect(px + 4, py + 12, TILE_SIZE - 8, TILE_SIZE - 14);
      ctx.fillStyle = '#8d4f22';
      ctx.fillRect(px + 12, py + 16, 8, 10);
      ctx.fillStyle = '#f2d27a';
      ctx.fillRect(px + 8, py + 14, 6, 6);
      ctx.fillStyle = '#f6e5a8';
      ctx.fillRect(px + 18, py + 14, 6, 6);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
  }

  function drawPlayer() {
    if (state.harvestAnim) return;
    let renderX = state.player.x * TILE_SIZE;
    let renderY = state.player.y * TILE_SIZE;
    if (state.move.active) {
      const t = Math.min(1, (state.now - state.move.startedAt) / state.move.duration);
      renderX = (state.move.fromX + (state.move.toX - state.move.fromX) * t) * TILE_SIZE;
      renderY = (state.move.fromY + (state.move.toY - state.move.fromY) * t) * TILE_SIZE;
    }
    if (spriteReady) {
      const frameW = Math.floor(sprite.width / SHEET_COLS);
      const frameH = Math.floor(sprite.height / SHEET_ROWS);
      const dir = state.player.dy === 1
        ? 'down'
        : state.player.dy === -1
          ? 'up'
          : state.player.dx === -1
            ? 'left'
            : 'right';
      const frameSet = MOVE_FRAMES_MAP[dir];
      const frameIndex = state.move.active
        ? Math.floor(((state.now - state.move.startedAt) / MOVE_FRAME_MS) % MOVE_FRAMES)
        : 1;
      const col = frameSet.cols[Math.min(frameSet.cols.length - 1, frameIndex)];
      const { sx, sy } = spriteFrame(col, frameSet.row, frameW, frameH);
      ctx.imageSmoothingEnabled = false;
      if (frameSet.flip) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
          sprite,
          sx,
          sy,
          frameW,
          frameH,
          -(renderX + 4 + SPRITE_SIZE),
          renderY + 4,
          SPRITE_SIZE,
          SPRITE_SIZE
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          sprite,
          sx,
          sy,
          frameW,
          frameH,
          renderX + 4,
          renderY + 4,
          SPRITE_SIZE,
          SPRITE_SIZE
        );
      }
    } else {
      ctx.fillStyle = '#4b9fea';
      ctx.fillRect(renderX + 8, renderY + 8, 16, 16);
      ctx.fillStyle = '#1b2b4a';
      ctx.fillRect(renderX + 12, renderY + 12, 4, 4);
      ctx.fillRect(renderX + 20, renderY + 12, 4, 4);
    }
  }

  function drawHarvest() {
    if (!state.harvestAnim || !spriteReady) return;
    const frameW = Math.floor(sprite.width / SHEET_COLS);
    const frameH = Math.floor(sprite.height / SHEET_ROWS);
    const elapsed = state.now - state.harvestAnim.startedAt;
    const frameIndex = Math.min(HARVEST_FRAMES - 1, Math.floor(elapsed / HARVEST_FRAME_MS));
    const rowSet = state.harvestAnim.type === TILE.TREE
      ? HARVEST_FRAMES_MAP.wood
      : HARVEST_FRAMES_MAP.rock;
    const col = rowSet.cols[Math.min(rowSet.cols.length - 1, frameIndex)];
    const { sx, sy } = spriteFrame(col, rowSet.row, frameW, frameH);
    const px = state.player.x * TILE_SIZE + 4;
    const py = state.player.y * TILE_SIZE + 4;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sprite,
      sx,
      sy,
      frameW,
      frameH,
      px,
      py,
      SPRITE_SIZE,
      SPRITE_SIZE
    );
  }

  function drawFacing() {
    const fx = (state.player.x + state.player.dx) * TILE_SIZE;
    const fy = (state.player.y + state.player.dy) * TILE_SIZE;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx + 2, fy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.lineWidth = 1;
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / BASE_WIDTH, canvas.height / BASE_HEIGHT);
    const offsetX = Math.floor((canvas.width - BASE_WIDTH * scale) / 2);
    const offsetY = Math.floor((canvas.height - BASE_HEIGHT * scale) / 2);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        drawTile(x, y, state.map[y][x]);
      }
    }
    drawHarvest();
    drawPlayer();
    drawFacing();
  }

  function gameLoop(timestamp: number) {
    if (state.lastTick === null) state.lastTick = timestamp;
    const delta = timestamp - state.lastTick;
    state.lastTick = timestamp;
    state.now = timestamp;
    if (state.move.active) {
      const t = (state.now - state.move.startedAt) / state.move.duration;
      if (t >= 1) {
        state.player.x = state.move.toX;
        state.player.y = state.move.toY;
        state.move.active = false;
      }
    }
    if (state.harvestAnim && state.now - state.harvestAnim.startedAt > HARVEST_DURATION_MS) {
      state.harvestAnim = null;
    }
    tickClock(delta);
    tickRespawns();
    render();
    rafId = requestAnimationFrame(gameLoop);
  }

  function handleKeyDown(event: KeyboardEvent) {
    const code = event.code;

    if (code === 'ArrowUp' || code === 'KeyW') movePlayer(0, -1);
    if (code === 'ArrowDown' || code === 'KeyS') movePlayer(0, 1);
    if (code === 'ArrowLeft' || code === 'KeyA') movePlayer(-1, 0);
    if (code === 'ArrowRight' || code === 'KeyD') movePlayer(1, 0);

    if (code === 'KeyE' && !event.repeat) harvest();
    if (code === 'KeyF' && !event.repeat) upgradeInn();
    if (code === 'KeyR' && !event.repeat) sellResources();
  }

  function init() {
    initMap();
    emitUi();
    logMessage('Welcome to Adventurers Inn.');
    window.addEventListener('keydown', handleKeyDown);
    rafId = requestAnimationFrame(gameLoop);
  }

  init();

  return {
    upgradeInn,
    sellResources,
    destroy() {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(rafId);
    }
  };
}
