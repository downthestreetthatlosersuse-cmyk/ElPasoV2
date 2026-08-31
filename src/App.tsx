import { useEffect, useRef, useState } from "react";
import { Game } from "./game/Game";
import { useHud, type Hud, UPG_NAMES, UPG_SHORT } from "./game/store";
import { initAudio } from "./game/audio";

/* ------------------------------------------------ HUD pieces */

function Crosshair({ h }: { h: Hud }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0 }}>
        <span className="absolute bg-[#ffd23f]" style={{ left: -1, top: "calc(-9px - var(--spr))", width: 2, height: 7, boxShadow: "0 0 5px #000" }} />
        <span className="absolute bg-[#ffd23f]" style={{ left: -1, top: "calc(2px + var(--spr))", width: 2, height: 7, boxShadow: "0 0 5px #000" }} />
        <span className="absolute bg-[#ffd23f]" style={{ left: "calc(-9px - var(--spr))", top: -1, width: 7, height: 2, boxShadow: "0 0 5px #000" }} />
        <span className="absolute bg-[#ffd23f]" style={{ left: "calc(2px + var(--spr))", top: -1, width: 7, height: 2, boxShadow: "0 0 5px #000" }} />
        <span className="absolute bg-[#ff5a2a]" style={{ left: -1, top: -1, width: 2, height: 2 }} />
        {h.hitId > 0 && (
          <span
            key={h.hitId}
            className="hitmarker absolute"
            style={{ left: -8, top: -8, width: 16, height: 16, border: "2px solid #ffffff", boxShadow: "0 0 8px rgba(255,255,255,0.6)" }}
          />
        )}
      </div>
    </div>
  );
}

function InGameHud({ h }: { h: Hud }) {
  const hpColor = h.health > 60 ? "#8dff3a" : h.health > 30 ? "#ffd23f" : "#ff3b30";
  return (
    <>


      <Crosshair h={h} />

      {/* bottom bar — vitals + ammunition */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4 pointer-events-none">
        <HealthPanel h={h} hpColor={hpColor} />
        <AmmoPanel h={h} />
      </div>
    </>
  );
}

function Corners({ color }: { color: string }) {
  return (
    <>
      <span className="brk brk-tl" style={{ borderColor: color }} />
      <span className="brk brk-tr" style={{ borderColor: color }} />
      <span className="brk brk-bl" style={{ borderColor: color }} />
      <span className="brk brk-br" style={{ borderColor: color }} />
    </>
  );
}

function HealthPanel({ h, hpColor }: { h: Hud; hpColor: string }) {
  const hp = Math.max(0, h.health);
  return (
    <div
      className={`tac px-4 pb-3 pt-2.5 w-[240px] ${hp <= 30 ? "crit" : ""}`}
      style={{ border: `1px solid ${hpColor}`, boxShadow: `0 0 0 2px #0c0514, 0 0 18px ${hpColor}33` }}
    >
      <Corners color={hpColor} />
      <div className="tac-stripe left-6" style={{ background: hpColor }} />
      <div className="flex items-end justify-between relative z-[1]">
        <div className="flex items-center gap-1.5 pb-1">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z" fill={hpColor} />
          </svg>
          <span className="font-display text-[10px] tracking-[0.28em]" style={{ color: hpColor }}>
            VITALS
          </span>
        </div>
        <span className="font-crt text-5xl leading-none glow-num" style={{ color: hpColor }}>
          {hp}
        </span>
      </div>
      {/* segmented bar with damage ghost trail */}
      <div className="relative h-4 mt-1 overflow-hidden bg-[rgba(8,4,14,0.9)]" style={{ transform: "skewX(-16deg)" }}>
        <div className="ghost-bar absolute inset-y-0 left-0" style={{ width: `${hp}%`, background: "rgba(255,90,70,0.85)" }} />
        <div
          className="live-bar absolute inset-y-0 left-0"
          style={{ width: `${hp}%`, background: hpColor, boxShadow: `0 0 10px ${hpColor}88` }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent 0, transparent calc(5% - 2px), rgba(8,4,14,0.95) calc(5% - 2px), rgba(8,4,14,0.95) 5%)",
          }}
        />
      </div>
    </div>
  );
}

function AmmoPanel({ h }: { h: Hud }) {
  const gold = "#ffd23f";
  const empty = h.mag === 0;
  const magPct = h.magSize > 0 ? (h.mag / h.magSize) * 100 : 0;
  return (
    <div className="tac px-4 pb-3 pt-2.5 w-[280px] text-right" style={{ border: `1px solid ${gold}`, boxShadow: `0 0 0 2px #0c0514, 0 0 18px ${gold}2e` }}>
      <Corners color={gold} />
      <div className="tac-stripe right-6" style={{ background: gold }} />
      {/* weapon slots */}
      <div className="flex items-center justify-end gap-1 relative z-[1]">
        {["SMG", "MAG", "SHT", "RKTL"].map((label, i) => (
          <span
            key={label}
            className={`font-crt text-sm leading-none px-1.5 py-0.5 border ${
              h.upgrades[i]
                ? "border-[#c05aff] text-[#e0b0ff] bg-[rgba(192,90,255,0.16)] neon-flicker"
                : h.weaponSlot === i
                  ? "border-[#8dff3a] text-[#8dff3a] bg-[rgba(141,255,58,0.12)]"
                  : "border-[#5a3a78] text-[#8a78a8]"
            }`}
            title={`Slot ${i + 1}: ${h.upgrades[i] ? UPG_NAMES[i] : label}`}
          >
            {i + 1} {h.upgrades[i] ? UPG_SHORT[i] : label}
          </span>
        ))}
      </div>
      <div className="flex items-end justify-end gap-2 relative z-[1]">
        <span className={`font-display text-[11px] tracking-[0.14em] pb-1 ${h.upgrades[h.weaponSlot] ? "text-[#e0b0ff]" : "text-[#8dff3a]"}`}>
          {h.weapon}
        </span>
        <span className="font-crt text-5xl leading-none glow-num" style={{ color: empty ? "#ff3b30" : gold }}>
          {h.mag}
        </span>
        <span className="font-crt text-xl text-[#f28b1d] pb-0.5">/ {h.reserve}</span>
      </div>
      {/* mag fill bar */}
      <div className="relative h-2.5 mt-1.5 overflow-hidden bg-[rgba(8,4,14,0.9)]" style={{ transform: "skewX(-16deg)" }}>
        <div
          className="live-bar absolute inset-y-0 right-0"
          style={{
            width: `${magPct}%`,
            background: empty ? "#ff3b30" : gold,
            boxShadow: `0 0 8px ${empty ? "#ff3b30" : gold}77`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent 0, transparent calc(12.5% - 2px), rgba(8,4,14,0.95) calc(12.5% - 2px), rgba(8,4,14,0.95) 12.5%)",
          }}
        />
      </div>
      <div className="relative z-[1] h-5 mt-1">
        {h.reloading ? (
          <div className="blinker font-crt text-lg text-[#ff5a5a] leading-none">RELOADING…</div>
        ) : empty && h.reserve === 0 ? (
          <div className="blinker font-crt text-lg text-[#ff5a5a] leading-none">OUT OF AMMO</div>
        ) : empty ? (
          <div className="blinker font-crt text-lg text-[#ff5a5a] leading-none">PRESS R</div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------ screens */

function ControlsPanel() {
  const rows: [string, string][] = [
    ["MOUSE", "AIM · HOLD LMB TO FIRE"],
    ["W A S D", "MOVE"],
    ["SHIFT", "SPRINT"],
    ["SPACE", "JUMP"],
    ["R", "RELOAD"],
    ["1-4 / WHEEL", "SWAP WEAPON"],
    ["ESC", "PAUSE"],
  ];
  return (
    <div className="hud-panel p-4 max-w-sm">
      <div className="font-display text-sm text-[#f28b1d] mb-2 tracking-wider">CONTROLS</div>
      <div className="flex flex-col gap-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-3">
            <span className="keycap">{k}</span>
            <span className="font-crt text-lg text-[#e8d8ff] leading-none">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuScreen({ h, onStart }: { h: Hud; onStart: () => void }) {
  return (
    <div
      className="absolute inset-0 z-40 overflow-hidden"
      style={{ background: "linear-gradient(180deg, rgba(14,4,20,0.78), rgba(14,4,20,0.42) 45%, rgba(14,4,20,0.85))" }}
    >
      <div className="absolute inset-0 menu-scan opacity-40 pointer-events-none" />
      <div className="relative h-full max-w-6xl mx-auto flex flex-col justify-between px-6 py-6 md:px-12 md:py-10">
        <div className="flex items-center justify-between">
          <div className="font-crt text-lg text-[#f28b1d] tracking-[0.3em]">
            <span className="inline-block w-2 h-2 bg-[#ff3b30] mr-2 neon-flicker" style={{ verticalAlign: "middle" }} />
            CH-3 BORDER FEED · LIVE
          </div>
          <div className="font-crt text-xl text-[#ffd23f]">PERSONAL BEST: {h.best}</div>
        </div>

        <div className="mt-4">
          <div className="font-crt text-2xl text-[#8dff3a] tracking-[0.35em]">DUKE-CLASS DEFENSE PROTOCOL</div>
          <h1 className="font-display title-chrome leading-[0.95] text-6xl md:text-8xl mt-1">EL PASO</h1>
          <h1 className="font-display title-blood leading-[0.95] text-5xl md:text-7xl -skew-x-6 ml-1">MELTDOWN</h1>
          <p className="font-crt text-2xl md:text-3xl text-[#ffd9a8] mt-4 max-w-2xl leading-snug">
            THE ALIEN HORDE CROSSED THE WALL AT SUNSET. THE PLAZA IS THE LAST LINE.
            <span className="text-[#8dff3a]"> SEND THEM BACK IN PIECES.</span>
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-6">
          <ControlsPanel />
          <div className="flex flex-col items-start md:items-end gap-3">
            <button className="btn-chunk text-2xl md:text-3xl px-10 py-4 flex items-center gap-3" onClick={onStart}>
              <svg width="22" height="22" viewBox="0 0 22 22">
                <path d="M4 2 L20 11 L4 20 Z" fill="#2a1004" />
              </svg>
              START MISSION
            </button>
            <div className="font-crt text-lg text-[#c8b8e8]">MOUSE LOCKS ON START · ESC PAUSES · SURVIVE THE WAVES</div>
            <div className="flex gap-2 mt-1">
              {[
                ["RATTLER SMG", "#8dff3a"],
                ["JUDGE MAGNUM", "#ffd23f"],
                ["PUMPER-8", "#ff9a2a"],
                ["BOOMSTICK", "#ff5a2a"],
              ].map(([name, col]) => (
                <span key={name} className="font-crt text-base px-2 py-0.5 border" style={{ color: col, borderColor: col, background: "rgba(10,4,16,0.6)" }}>
                  {name}
                </span>
              ))}
            </div>
            <div className="font-crt text-xl text-[#8dff3a] neon-flicker">FIELD TIP: EL JEFE SHOWS UP EVERY 5TH WAVE. THE BOOMSTICK INTRODUCES HIMSELF.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PauseScreen({ onResume, onMenu }: { onResume: () => void; onMenu: () => void }) {
  return (
    <div className="absolute inset-0 z-40 bg-[rgba(10,4,16,0.78)] flex items-center justify-center">
      <div className="hud-panel p-8 max-w-md w-full mx-4">
        <div className="font-display text-5xl title-chrome">PAUSED</div>
        <div className="font-crt text-xl text-[#ffd9a8] mt-2">THE HORDE WAITS FOR NO ONE, TEX.</div>
        <div className="flex flex-col gap-3 mt-6">
          <button className="btn-chunk text-xl px-6 py-3" onClick={onResume}>
            RESUME FIGHTING
          </button>
          <button
            className="font-display text-sm px-6 py-3 border-2 border-[#f28b1d] text-[#f28b1d] hover:bg-[rgba(242,139,29,0.15)] cursor-pointer"
            onClick={onMenu}
          >
            ABORT TO MENU
          </button>
        </div>
        <div className="font-crt text-lg text-[#8a78a8] mt-5">
          R RELOAD · SHIFT SPRINT · 1/2 WEAPONS · WHEEL SWAP
        </div>
      </div>
    </div>
  );
}

const DEATH_QUOTES = [
  "THAT'S ONE UGLY WAY TO GO.",
  "EL PASO WILL REMEMBER YOU. PROBABLY.",
  "THE HORDE WANTS A WORD: OW.",
  "NOT IN MY CITY. NOT LIKE THIS.",
  "GRAVEYARD'S FULL — THEY'LL MAKE ROOM.",
];

function GameOverScreen({ h, onRestart, onMenu }: { h: Hud; onRestart: () => void; onMenu: () => void }) {
  const [quote, setQuote] = useState(DEATH_QUOTES[0]);
  useEffect(() => {
    setQuote(DEATH_QUOTES[Math.floor(Math.random() * DEATH_QUOTES.length)]);
  }, []);
  const newBest = h.score > 0 && h.score >= h.best;
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center"
      style={{ background: "radial-gradient(ellipse at center, rgba(60,4,10,0.72), rgba(14,2,10,0.9))" }}
    >
      <div className="max-w-xl w-full mx-4 text-center">
        <div className="font-crt text-2xl text-[#ff9a8a] tracking-[0.3em]">MISSION FAILED · WAVE {h.wave}</div>
        <div className="font-display text-6xl md:text-7xl title-blood mt-1">YOU ATE DIRT</div>
        <div className="font-crt text-2xl text-[#ffd9a8] mt-2">{quote}</div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-7">
          {[
            ["SCORE", String(h.score)],
            ["KILLS", String(h.kills)],
            ["WAVES", String(Math.max(0, h.wave - 1))],
            ["BEST", String(h.best)],
          ].map(([k, v]) => (
            <div key={k} className="hud-panel px-2 py-3">
              <div className="font-crt text-sm text-[#f28b1d] tracking-widest">{k}</div>
              <div className="font-crt text-4xl text-[#ffd23f] leading-none mt-1">{v}</div>
            </div>
          ))}
        </div>
        {newBest && <div className="blinker font-display text-xl text-[#8dff3a] mt-3">NEW PERSONAL BEST</div>}

        <div className="flex items-center justify-center gap-4 mt-7">
          <button className="btn-chunk text-xl px-8 py-4" onClick={onRestart}>
            RUN IT BACK
          </button>
          <button
            className="font-display text-sm px-6 py-3 border-2 border-[#f28b1d] text-[#f28b1d] hover:bg-[rgba(242,139,29,0.15)] cursor-pointer"
            onClick={onMenu}
          >
            MENU
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ app */

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const h = useHud();

  useEffect(() => {
    if (!mountRef.current) return;
    const g = new Game(mountRef.current);
    gameRef.current = g;
    return () => {
      g.dispose();
      gameRef.current = null;
    };
  }, []);

  const start = () => {
    initAudio();
    gameRef.current?.startGame();
  };
  const resume = () => {
    initAudio();
    gameRef.current?.resume();
  };
  const toMenu = () => gameRef.current?.toMenu();

  const hudVisible = h.state === "playing" || h.state === "paused";

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none">
      {/* 3D canvas mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* HUD layer (always mounted so radar canvas exists) */}
      <div className={`absolute inset-0 z-30 pointer-events-none ${hudVisible ? "" : "invisible"}`}>
        <InGameHud h={h} />
      </div>

      {/* damage + low hp + nuke */}
      {h.dmgId > 0 && h.state === "playing" && <div key={h.dmgId} className="absolute inset-0 dmg-flash pointer-events-none z-30" />}
      {h.state === "playing" && h.health <= 30 && h.health > 0 && <div className="absolute inset-0 lowhp pointer-events-none z-30" />}
      {h.nukeId > 0 && h.state === "playing" && <div key={`n${h.nukeId}`} className="absolute inset-0 nuke-flash pointer-events-none z-30" />}
      {h.boomId > 0 && h.state === "playing" && <div key={`b${h.boomId}`} className="absolute inset-0 boom-flash pointer-events-none z-20" />}
      {h.gunFlashId > 0 && h.state === "playing" && (
        <div
          key={`gf${h.gunFlashId}`}
          className="absolute inset-0 gun-flash pointer-events-none z-20"
          style={{ background: `radial-gradient(ellipse at center, ${h.gunFlashColor}55, ${h.gunFlashColor}22 55%, transparent 80%)` }}
        />
      )}

      {/* CRT layers — scanlines/vignette are now in the post shader */}
      <div className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
        <div className="crt-roll" />
      </div>

      {/* screens */}
      {h.state === "menu" && <MenuScreen h={h} onStart={start} />}
      {h.state === "paused" && <PauseScreen onResume={resume} onMenu={toMenu} />}
      {h.state === "gameover" && <GameOverScreen h={h} onRestart={start} onMenu={toMenu} />}
    </div>
  );
}
