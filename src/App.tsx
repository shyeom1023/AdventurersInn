import { useEffect, useRef, useState } from 'react';
import { createGame, defaultUi, type GameApi, type UiSnapshot } from './game';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<GameApi | null>(null);
  const [ui, setUi] = useState<UiSnapshot>(defaultUi);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createGame(canvas, setUi);
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    const resize = () => {
      const rect = frame.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };

    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    resize();

    return () => observer.disconnect();
  }, []);

  return (
    <div className="page">
      <header className="topbar">
        <div className="title">Adventurers Inn</div>
        <div className="subtitle">Pixel grid • Harvest • Upgrade</div>
      </header>

      <main className="layout">
        <aside className="panel">
          <section className="panel-block">
            <h2>Inventory</h2>
            <div className="stat-row">
              <span>Wood</span>
              <span>{ui.wood}</span>
            </div>
            <div className="stat-row">
              <span>Stone</span>
              <span>{ui.stone}</span>
            </div>
          </section>

          <section className="panel-block">
            <h2>Inn</h2>
            <div className="stat-row">
              <span>Level</span>
              <span>{ui.innLevel}</span>
            </div>
            <div className="cost">{ui.upgradeCostText}</div>
            <button
              className="primary"
              type="button"
              disabled={!ui.canUpgrade}
              onClick={() => gameRef.current?.upgradeInn()}
            >
              Upgrade (F)
            </button>
            <button
              className="secondary"
              type="button"
              disabled={!ui.canSell}
              onClick={() => gameRef.current?.sellResources()}
            >
              Sell Resources (R)
            </button>
            <div className="cost">{ui.sellRatesText}</div>
          </section>

          <section className="panel-block">
            <h2>Controls</h2>
            <div className="hint">Move: WASD / Arrow Keys</div>
            <div className="hint">Harvest: E (facing tile)</div>
            <div className="hint">Upgrade: F (near inn)</div>
            <div className="hint">Sell: R (near inn)</div>
          </section>

          <section className="panel-block">
            <h2>Log</h2>
            <div className="log">
              {ui.logs.map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </div>
          </section>
        </aside>

        <section className="canvas-wrap">
          <div className="game-frame" ref={frameRef}>
            <canvas ref={canvasRef} className="game-canvas" />
            <div className="hud">
            <div className="hud-top">
              <div className="hud-panel time-panel">
                <div className="hud-label">Day</div>
                <div className="hud-value">{ui.clock.day}</div>
                <div className="hud-time">{ui.clock.time}</div>
              </div>
              <div className="hud-panel weather-panel">
                <div className="hud-label">Weather</div>
                <div className="hud-value">{ui.clock.weather}</div>
              </div>
              <div className="hud-panel stats-panel">
                <div className="hud-label">Stats</div>
                <div className="hud-row">
                  <span className="hud-key">Gold</span>
                  <span className="hud-value">{ui.stats.gold}</span>
                </div>
                <div className="hud-row">
                  <span className="hud-key">HP</span>
                  <div className="hud-bar">
                    <div className="hud-bar-fill hp" style={{ width: `${ui.stats.hpPct}%` }} />
                  </div>
                  <span className="hud-mini">{ui.stats.hpText}</span>
                </div>
                <div className="hud-row">
                  <span className="hud-key">Stam</span>
                  <div className="hud-bar">
                    <div className="hud-bar-fill stam" style={{ width: `${ui.stats.stamPct}%` }} />
                  </div>
                  <span className="hud-mini">{ui.stats.stamText}</span>
                </div>
              </div>
            </div>
            <div className="hud-bottom">
              <div className="toolbar">
                <div className="slot active">
                  <div className="slot-icon">W</div>
                  <div className="slot-count">{ui.wood}</div>
                </div>
                <div className="slot">
                  <div className="slot-icon">S</div>
                  <div className="slot-count">{ui.stone}</div>
                </div>
                <div className="slot" />
                <div className="slot" />
                <div className="slot" />
                <div className="slot" />
                <div className="slot" />
                <div className="slot" />
              </div>
              <div className="toolbar-hint">E: Harvest · F: Upgrade · R: Sell</div>
            </div>
            </div>
          </div>
          <div className="legend">
            <span className="chip grass">Grass</span>
            <span className="chip tree">Tree</span>
            <span className="chip rock">Rock</span>
            <span className="chip inn">Inn</span>
          </div>
        </section>
      </main>
    </div>
  );
}
