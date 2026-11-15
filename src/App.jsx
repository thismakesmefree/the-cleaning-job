import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorld, drawWorld, GAME_STATES, HEIGHT, updateWorld, WIDTH } from './game.js';

const CUTSCENES = [
  { src: '/clip1.mp4', label: 'DISTRESS CALL // 01', subtitle: 'ARES CONTROL: MAYDAY. The Mars outpost is under attack. We are losing telemetry.' },
  { src: '/clip2.mp4', label: 'DISTRESS CALL // 02', subtitle: 'PILOT: Copy, Control. I’m inbound. Keep the beacon alive — I’m bringing her home.' },
];

function useSynthAudio() {
  const audioRef = useRef(null);
  const ensureContext = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioRef.current) audioRef.current = new AudioContext();
    if (audioRef.current.state === 'suspended') audioRef.current.resume();
    return audioRef.current;
  }, []);

  const playSound = useCallback((kind) => {
    const audio = ensureContext();
    if (!audio) return;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    if (kind === 'pew') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(660, now);
      oscillator.frequency.exponentialRampToValueAtTime(210, now + 0.11);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      oscillator.start(now);
      oscillator.stop(now + 0.13);
    } else {
      oscillator.type = kind === 'explosion' ? 'triangle' : 'square';
      oscillator.frequency.setValueAtTime(kind === 'explosion' ? 170 : 420, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'explosion' ? 42 : 115, now + 0.24);
      gain.gain.setValueAtTime(kind === 'explosion' ? 0.11 : 0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      oscillator.start(now);
      oscillator.stop(now + 0.27);
    }
  }, [ensureContext]);

  return { ensureContext, playSound };
}

function MissionButton({ children, onClick, secondary = false }) {
  return (
    <button className={`mission-button${secondary ? ' mission-button--secondary' : ''}`} onClick={onClick}>
      <span>{children}</span><b aria-hidden="true">↗</b>
    </button>
  );
}

function TitleScreen({ onStart }) {
  return (
    <main className="title-screen">
      <div className="title-sky" aria-hidden="true">
        <div className="planet" />
        <div className="orbit orbit--one" />
        <div className="orbit orbit--two" />
        <div className="title-stars" />
      </div>
      <header className="site-mark"><span className="mark-icon">A</span><span>ARES <i>MISSION SYSTEMS</i></span><span className="mark-status"><em /> SIGNAL DETECTED</span></header>
      <section className="title-copy">
        <p className="eyebrow"><span className="crosshair">⊹</span> DEEP SPACE // EMERGENCY CHANNEL OPEN</p>
        <h1>ARES <span>SOS</span></h1>
        <p className="title-subtitle">A beacon in the red. One pilot. One shot to bring them home.</p>
        <div className="title-rule"><span>MISSION 07-ARES</span><span>EARTH → MARS</span></div>
        <MissionButton onClick={onStart}>START MISSION</MissionButton>
        <p className="title-hint">A NASA-INSPIRED ARCADE RESCUE MISSION</p>
      </section>
      <footer className="title-footer"><span>FLIGHT CONTROL ONLINE</span><span>© ARES DEEP SPACE PROGRAM</span><span>VOL. 01 / 2054</span></footer>
    </main>
  );
}

function Cutscene({ index, onNext, onSkip }) {
  const scene = CUTSCENES[index];
  return (
    <main className="cutscene">
      <video
        key={scene.src}
        className="cutscene-video"
        src={scene.src}
        autoPlay
        playsInline
        onEnded={onNext}
        onError={onNext}
        aria-label={`Mission transmission ${index + 1}`}
      />
      <div className="cutscene-vignette" />
      <div className="transmission-label"><span className="live-dot" /> INCOMING TRANSMISSION <span>ENCRYPTED // {index + 1}/2</span></div>
      <button className="skip-button" onClick={onSkip}>SKIP <span>»</span></button>
      <div className="subtitle-card">
        <span>{scene.label}</span>
        <p>{scene.subtitle}</p>
      </div>
      <div className="cutscene-progress"><i style={{ width: `${(index + 1) * 50}%` }} /></div>
    </main>
  );
}

function Telemetry() {
  return (
    <aside className="telemetry">
      <div className="telemetry-heading"><span className="telemetry-dot" /> NASA TELEMETRY <span>LIVE</span></div>
      <div className="telemetry-grid">
        <div><small>GRAVITY</small><strong>3.72 <i>m/s²</i></strong></div>
        <div><small>ATMOSPHERE</small><strong>95% <i>CO₂</i></strong></div>
        <div><small>EARTH DISTANCE</small><strong>225 <i>M km</i></strong></div>
      </div>
    </aside>
  );
}

function Hud({ world, stage }) {
  const health = world.player.hull;
  return (
    <>
      <header className="game-topbar">
        <div className="game-brand"><span className="mini-mark">A</span><span>ARES <i>// RESCUE FLIGHT</i></span></div>
        <div className="mission-phase"><span className="live-dot" /> {stage === GAME_STATES.LEVEL_0_ASTEROIDS ? 'PHASE 01 / ASTEROID BELT' : 'PHASE 02 / MARS SURFACE'}</div>
        <div className="score">SCORE <b>{String(world.score).padStart(5, '0')}</b></div>
      </header>
      <div className="hud-left">
        {stage === GAME_STATES.LEVEL_0_ASTEROIDS && (
          <div className="hud-panel distance-panel">
            <div className="bar-label"><span>DISTANCE TO MARS</span><strong>{Math.ceil(world.distance)}%</strong></div>
            <div className="bar-track"><i className="distance-fill" style={{ width: `${world.distance}%` }} /></div>
            <div className="bar-caption"><span>EARTH ORBIT</span><span>MARS</span></div>
          </div>
        )}
        <div className="hud-panel hull-panel">
          <div className="bar-label"><span>HULL INTEGRITY</span><strong>{health}%</strong></div>
          <div className="bar-track"><i className={`hull-fill${health < 35 ? ' hull-fill--critical' : ''}`} style={{ width: `${health}%` }} /></div>
        </div>
      </div>
      {stage === GAME_STATES.LEVEL_0_ASTEROIDS ? (
        <div className="stage-tip"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> FLIGHT <span className="tip-divider" /> <kbd>SPACE</kbd> FIRE</div>
      ) : (
        <>
          <div className="mars-tip"><kbd>A</kbd><kbd>D</kbd> MOVE <span className="tip-divider" /> <kbd>W</kbd>/<kbd>SPACE</kbd> JUMP <span className="tip-divider" /> <kbd>J</kbd> / CLICK FIRE</div>
          <Telemetry />
          {world.boss && world.boss.hp > 0 && (
            <div className="boss-hud"><div><span>HIVEMIND GENERAL</span><strong>{world.boss.hp} / {world.boss.maxHp}</strong></div><div className="bar-track"><i style={{ width: `${(world.boss.hp / world.boss.maxHp) * 100}%` }} /></div></div>
          )}
        </>
      )}
    </>
  );
}

function Debrief({ result, onReplay }) {
  return (
    <div className="debrief-backdrop">
      <section className="debrief-card">
        <p className="eyebrow">{result === 'won' ? 'MISSION COMPLETE // MARS OUTPOST SECURED' : 'MISSION FAILED // SIGNAL LOST'}</p>
        <h2>{result === 'won' ? 'Beacon restored.' : 'The beacon fades.'}</h2>
        <p className="debrief-copy">
          {result === 'won'
            ? 'The ARES crew is safe. Mission control has the signal.'
            : 'ARES control has lost contact with the rescue craft.'}
        </p>
        <div className="inspiration-note">
          <span>SCIENCE BEHIND THE STORY</span>
          <p>Planetary defense takes real-world practice: NASA’s <b>DART</b> mission proved an asteroid’s orbit can be changed, while the <b>xEMU</b> spacesuit program advances life-support and mobility for exploration. Both inspired ARES’s shield-and-rescue systems.</p>
        </div>
        <MissionButton onClick={onReplay}>FLY AGAIN</MissionButton>
      </section>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState(GAME_STATES.TITLE_SCREEN);
  const [cutsceneIndex, setCutsceneIndex] = useState(0);
  const [debrief, setDebrief] = useState(null);
  const [hudWorld, setHudWorld] = useState(null);
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const keysRef = useRef(new Set());
  const fireRef = useRef(false);
  const aimRef = useRef({ x: 480, y: 270 });
  const artRef = useRef({});
  const { ensureContext, playSound } = useSynthAudio();

  useEffect(() => {
    const sources = {
      marsBackground: '/art/mars-backdrop.png',
      protagonist: '/art/ares-protagonist.png',
      footSoldier: '/art/alien-foot-soldier.png',
      cyborg: '/art/armored-cyborg.png',
      hivemind: '/art/hivemind-general.png',
    };
    const images = Object.entries(sources).map(([name, src]) => {
      const image = new Image();
      image.onerror = () => console.warn(`Could not load ${src}; using the procedural fallback.`);
      image.src = src;
      artRef.current[name] = image;
      return image;
    });

    return () => {
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
      }
    };
  }, []);

  const beginFlight = useCallback(() => {
    setDebrief(null);
    worldRef.current = createWorld(GAME_STATES.LEVEL_0_ASTEROIDS);
    setHudWorld(null);
    setStage(GAME_STATES.LEVEL_0_ASTEROIDS);
  }, []);

  const startMission = useCallback(() => {
    ensureContext();
    setCutsceneIndex(0);
    setStage(GAME_STATES.CUTSCENE);
  }, [ensureContext]);

  const nextCutscene = useCallback(() => {
    if (cutsceneIndex + 1 < CUTSCENES.length) setCutsceneIndex((value) => value + 1);
    else beginFlight();
  }, [beginFlight, cutsceneIndex]);

  useEffect(() => {
    if (stage !== GAME_STATES.LEVEL_0_ASTEROIDS && stage !== GAME_STATES.LEVEL_1_MARS) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameId;
    let previous = performance.now();
    let lastHud = 0;
    let stageChanged = false;
    worldRef.current = createWorld(stage);

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = WIDTH * ratio;
      canvas.height = HEIGHT * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = (now) => {
      const dt = Math.min((now - previous) / 1000, 0.045);
      previous = now;
      const keys = keysRef.current;
      const left = keys.has('a') || keys.has('arrowleft');
      const right = keys.has('d') || keys.has('arrowright');
      const up = keys.has('w') || keys.has('arrowup');
      const down = keys.has('s') || keys.has('arrowdown');
      const jump = keys.has(' ') || keys.has('w') || keys.has('arrowup');
      const controls = {
        moveX: Number(right) - Number(left),
        moveY: Number(down) - Number(up),
        jump,
        fire: fireRef.current || keys.has(' ') || keys.has('j'),
        aim: aimRef.current,
      };
      const world = worldRef.current;
      updateWorld(world, dt, controls, {
        sound: playSound,
        stageChange: (nextStage) => {
          if (stageChanged) return;
          stageChanged = true;
          setStage(nextStage);
        },
      });
      drawWorld(ctx, world, artRef.current);
      if (world.transition > 0) {
        ctx.fillStyle = 'rgba(4, 9, 15, .84)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#72edff';
        ctx.font = '700 22px monospace';
        ctx.fillText('ENTERING MARTIAN ATMOSPHERE', WIDTH / 2, HEIGHT / 2);
        ctx.fillStyle = '#bbd6df';
        ctx.font = '12px monospace';
        ctx.fillText('THERMAL SHIELD ENGAGED // DESCENT BURN', WIDTH / 2, HEIGHT / 2 + 28);
      }
      if (world.debrief && !stageChanged) {
        stageChanged = true;
        setDebrief(world.result || 'lost');
      }
      if (now - lastHud > 140) {
        setHudWorld({ ...world, player: { ...world.player }, boss: world.boss ? { ...world.boss } : null });
        lastHud = now;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, [stage, playSound]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
      keysRef.current.add(key);
    };
    const onKeyUp = (event) => keysRef.current.delete(event.key.toLowerCase());
    const clearKeys = () => {
      keysRef.current.clear();
      fireRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
    };
  }, []);

  const updateAim = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    aimRef.current = {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  if (stage === GAME_STATES.TITLE_SCREEN) return <TitleScreen onStart={startMission} />;
  if (stage === GAME_STATES.CUTSCENE) return <Cutscene index={cutsceneIndex} onNext={nextCutscene} onSkip={beginFlight} />;

  return (
    <main className="game-shell">
      <div className={`game-stage${stage === GAME_STATES.LEVEL_1_MARS ? ' game-stage--mars' : ''}`}>
        <canvas
          ref={canvasRef}
          className="game-canvas"
          aria-label={stage === GAME_STATES.LEVEL_0_ASTEROIDS ? 'Asteroid flight survival game' : 'Mars run-and-gun game'}
          onPointerMove={updateAim}
          onPointerDown={(event) => { updateAim(event); fireRef.current = true; }}
          onPointerUp={() => { fireRef.current = false; }}
          onPointerLeave={() => { fireRef.current = false; }}
        />
        {hudWorld && <Hud world={hudWorld} stage={stage} />}
        {debrief && <Debrief result={debrief} onReplay={beginFlight} />}
      </div>
    </main>
  );
}
