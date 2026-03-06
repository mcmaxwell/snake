(() => {
  let CANVAS_WIDTH = window.innerWidth;
  let CANVAS_HEIGHT = window.innerHeight;
  const CHAR_SCALE = 1.2;
  const S = (n) => Math.round(n * CHAR_SCALE);
  const GRAVITY = 0.6;
  const JUMP_VELOCITY = -16;
  const OBSTACLE_INTERVAL = 85; // frames between obstacles (more frequent)
  const OBSTACLE_SPEED = 5.4;
  const DASH_SPEED_MULT = 2;
  const PLAYER_START_X = 64;
  const MAX_GAME_WIDTH = 960;
  const MAX_GAME_HEIGHT = 540;
  const DASH_TRAIL_X_OFFSET = 7;
  const DASH_TRAIL_Y_OFFSET = 10;
  const DASH_TRAIL_SHORT = 8;
  const DASH_TRAIL_LONG = 14;
  const DASH_TRAIL_SPAWN_RATE = 2; // lower is denser trail
  const GROUND_HEIGHT = 5;
  const END_SCORE = 268415;
  const END_TITLE_DURATION_MS = 6700;
  const END_CAR_APPROACH_MS = 2200;
  const END_CAR_STOP_MS = 1600;
  const END_DROP_CAR_APPROACH_MS = 1800;
  const END_DROP_CAR_STOP_MS = 1000;
  const END_DROP_CAR_EXIT_SPEED = S(5.5);
  const END_CAR_W = S(126);
  const END_CAR_H = S(62);
  const HUD_X = 16;
  const HUD_SCORE_Y = 28;
  const HUD_DAILY_Y = 52;
  const HUD_ATHS_Y = 76;
  const HUD_ATHS_HEIGHT = 20;
  const DAILY_HIGHS_STORAGE_KEY = 'runningDinoDailyHigh';
  const ALL_TIME_HIGHS_STORAGE_KEY = 'runningDinoAllTimeHigh';
  const DINO_HIGHS_API_URL = '/api/running-dino-highscores';
  const PLAYER_STAND_HEIGHT = S(60);
  const PLAYER_DUCK_HEIGHT = S(38);
  const DINO_SPECIES = [
    { name: 'Tyrannosaurus rex', archetype: 'theropod' },
    { name: 'Triceratops', archetype: 'horned' },
    { name: 'Stegosaurus', archetype: 'armored' },
    { name: 'Velociraptor', archetype: 'raptor' },
    { name: 'Spinosaurus', archetype: 'sail' },
    { name: 'Brachiosaurus', archetype: 'longneck' },
    { name: 'Ankylosaurus', archetype: 'armored' },
    { name: 'Allosaurus', archetype: 'theropod' },
    { name: 'Diplodocus', archetype: 'longneck' },
    { name: 'Iguanodon', archetype: 'horned' },
    { name: 'Parasaurolophus', archetype: 'sail' },
    { name: 'Pachycephalosaurus', archetype: 'armored' },
    { name: 'Carnotaurus', archetype: 'theropod' },
    { name: 'Giganotosaurus', archetype: 'theropod' },
    { name: 'Deinonychus', archetype: 'raptor' },
    { name: 'Microraptor', archetype: 'flying', isFlying: true },
    { name: 'Oviraptor', archetype: 'raptor' },
    { name: 'Therizinosaurus', archetype: 'clawed' },
    { name: 'Utahraptor', archetype: 'raptor' },
    { name: 'Argentinosaurus', archetype: 'longneck' }
  ];

  let obstacleTimer = 0;
  let obstacles = []; // { x, y, width, height, color, phase, species, archetype, isFlying, mark }
  let isDashing = false;
  let isDucking = false;
  let score = 0;
  let scoreTimer = null;
  let scoreTick = 0;
  let dailyHighScore = 0;
  let allTimeHighScore = 0;
  let highScoreSyncTimer = null;
  let highScoreSyncInFlight = false;
  let showFullATHSLabel = false;
  let athsClickBounds = { x: HUD_X, y: HUD_ATHS_Y - 16, width: 200, height: HUD_ATHS_HEIGHT };
  let darkPhaseActive = false;
  let darkPhaseTimer = null;
  let nextDarkPhaseScore = 1000;
  let endSequenceActive = false;
  let endSequenceStartMs = 0;
  let endSequencePhase = 'pickup';
  let endPlayerVisible = true;
  let endCarHasPlayer = false;
  let endCarX = 0;
  let endCarY = 0;
  let endCarStartX = 0;
  let endCarStopX = 0;
  let dropCarX = 0;
  let dropCarY = 0;
  let dropCarStartX = 0;
  let dropCarStopX = 0;
  let dropCarHasPlayer = true;
  let gKeyDown = false;
  let fKeyDown = false;
  let gfComboLatched = false;
  let bKeyDown = false;
  let lKeyDown = false;
  let blComboLatched = false;
  let dashTrails = []; // { x, y, len, alpha }
  let dashTrailTick = 0;

  const canvas = document.getElementById('game-canvas');
  const baseCtx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');

  function getTodayDateKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function loadHighScores() {
    const dailyRaw = localStorage.getItem(DAILY_HIGHS_STORAGE_KEY);
    if (dailyRaw) {
      try {
        const daily = JSON.parse(dailyRaw);
        if (daily.date === getTodayDateKey()) {
          dailyHighScore = Number(daily.score) || 0;
        } else {
          dailyHighScore = 0;
        }
      } catch {
        dailyHighScore = 0;
      }
    }

    const allTimeRaw = localStorage.getItem(ALL_TIME_HIGHS_STORAGE_KEY);
    allTimeHighScore = Number(allTimeRaw) || 0;

    // Sync with database in the background while keeping local fallback values.
    syncHighScoresWithDb();
  }

  function persistDailyHigh() {
    localStorage.setItem(DAILY_HIGHS_STORAGE_KEY, JSON.stringify({
      date: getTodayDateKey(),
      score: dailyHighScore
    }));
  }

  function persistAllTimeHigh() {
    localStorage.setItem(ALL_TIME_HIGHS_STORAGE_KEY, String(allTimeHighScore));
  }

  async function fetchDbHighScores() {
    try {
      const res = await fetch(DINO_HIGHS_API_URL);
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch {
      return null;
    }
  }

  async function persistHighScoresToDb() {
    if (highScoreSyncInFlight) return;
    highScoreSyncInFlight = true;
    try {
      await fetch(DINO_HIGHS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_high: dailyHighScore,
          all_time_high: allTimeHighScore,
          daily_date: getTodayDateKey()
        })
      });
    } catch {
      // Keep local storage as fallback when DB is unavailable.
    } finally {
      highScoreSyncInFlight = false;
    }
  }

  async function resetAllTimeHighInDb() {
    try {
      await fetch(DINO_HIGHS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_all_time: true })
      });
    } catch {
      // Keep local reset; DB can sync later if unavailable.
    }
  }

  function scheduleHighScoreSync() {
    if (highScoreSyncTimer) return;
    highScoreSyncTimer = setTimeout(() => {
      highScoreSyncTimer = null;
      persistHighScoresToDb();
    }, 1500);
  }

  async function syncHighScoresWithDb() {
    const remote = await fetchDbHighScores();
    if (!remote) return;

    const today = getTodayDateKey();
    const remoteDaily = remote.daily_date === today ? (Number(remote.daily_high) || 0) : 0;
    const remoteAllTime = Number(remote.all_time_high) || 0;

    // Keep the best values from local+remote, then push merged result back once.
    const mergedDaily = Math.max(dailyHighScore, remoteDaily);
    const mergedAllTime = Math.max(allTimeHighScore, remoteAllTime);
    const changed = mergedDaily !== dailyHighScore || mergedAllTime !== allTimeHighScore;

    dailyHighScore = mergedDaily;
    allTimeHighScore = mergedAllTime;
    persistDailyHigh();
    persistAllTimeHigh();

    if (changed || remoteDaily !== mergedDaily || remoteAllTime !== mergedAllTime) {
      scheduleHighScoreSync();
    }
  }

  function updateHighScoresIfNeeded() {
    let changed = false;
    if (score > dailyHighScore) {
      dailyHighScore = score;
      persistDailyHigh();
      changed = true;
    }
    if (score > allTimeHighScore) {
      allTimeHighScore = score;
      persistAllTimeHigh();
      changed = true;
    }
    if (changed) {
      scheduleHighScoreSync();
    }
  }

  function parseColor(color) {
    if (typeof color !== 'string') return null;
    const c = color.trim().toLowerCase();
    if (c === 'black') return { r: 0, g: 0, b: 0, a: 1 };
    if (c === 'white') return { r: 255, g: 255, b: 255, a: 1 };

    if (c.startsWith('#')) {
      if (c.length === 4) {
        return {
          r: parseInt(c[1] + c[1], 16),
          g: parseInt(c[2] + c[2], 16),
          b: parseInt(c[3] + c[3], 16),
          a: 1
        };
      }
      if (c.length === 7) {
        return {
          r: parseInt(c.slice(1, 3), 16),
          g: parseInt(c.slice(3, 5), 16),
          b: parseInt(c.slice(5, 7), 16),
          a: 1
        };
      }
      return null;
    }

    const rgbMatch = c.match(/^rgba?\(([^)]+)\)$/);
    if (!rgbMatch) return null;
    const parts = rgbMatch[1].split(',').map(v => v.trim());
    if (parts.length < 3) return null;
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = parts.length > 3 ? Number(parts[3]) : 1;
    if ([r, g, b, a].some(n => Number.isNaN(n))) return null;
    return { r, g, b, a };
  }

  function toCss({ r, g, b, a }) {
    const rr = Math.max(0, Math.min(255, Math.round(r)));
    const gg = Math.max(0, Math.min(255, Math.round(g)));
    const bb = Math.max(0, Math.min(255, Math.round(b)));
    const aa = Math.max(0, Math.min(1, a));
    if (aa < 1) {
      return `rgba(${rr},${gg},${bb},${aa})`;
    }
    return `rgb(${rr},${gg},${bb})`;
  }

  function remapDarkPhaseColor(color) {
    if (!darkPhaseActive) return color;
    const parsed = parseColor(color);
    if (!parsed) return color;

    const { r, g, b, a } = parsed;
    const isWhite = r >= 245 && g >= 245 && b >= 245;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const isDark = luminance < 90;

    if (isWhite) {
      return toCss({ r: 255, g: 255, b: 255, a });
    }
    if (isDark) {
      // Opposite color for dark shades.
      return toCss({ r: 255 - r, g: 255 - g, b: 255 - b, a });
    }

    // Non-dark and non-white colors become light-gray shades.
    const gray = Math.max(185, Math.min(235, Math.round((r + g + b) / 3)));
    return toCss({ r: gray, g: gray, b: gray, a });
  }

  const ctx = new Proxy(baseCtx, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
    set(target, prop, value) {
      if ((prop === 'fillStyle' || prop === 'strokeStyle') && typeof value === 'string') {
        target[prop] = remapDarkPhaseColor(value);
      } else {
        target[prop] = value;
      }
      return true;
    }
  });

  function triggerDarkPhase() {
    darkPhaseActive = true;
    if (darkPhaseTimer) clearTimeout(darkPhaseTimer);
    darkPhaseTimer = setTimeout(() => {
      darkPhaseActive = false;
      darkPhaseTimer = null;
    }, 10000);
  }

  function triggerEndSequence() {
    endSequenceActive = true;
    endSequenceStartMs = Date.now();
    endSequencePhase = 'pickup';
    endPlayerVisible = true;
    endCarHasPlayer = false;

    // Freeze gameplay state and clear hazards.
    obstacles = [];
    isDashing = false;
    isDucking = false;
    dashTrails = [];
    dashTrailTick = 0;
    player.vy = 0;
    player.height = PLAYER_STAND_HEIGHT;
    player.y = CANVAS_HEIGHT - player.height;

    // Cancel dark phase visuals during ending cinematic.
    darkPhaseActive = false;
    if (darkPhaseTimer) {
      clearTimeout(darkPhaseTimer);
      darkPhaseTimer = null;
    }

    // Car starts off-screen and drives to the player.
    endCarY = CANVAS_HEIGHT - GROUND_HEIGHT - END_CAR_H;
    endCarStartX = CANVAS_WIDTH + S(140);
    // Align the car cabin over the player so pickup visibly covers the body.
    const playerCenterX = player.x + player.width / 2;
    const cabinCenterOffset = S(66); // tuned to center of cabin/window area
    endCarStopX = playerCenterX - cabinCenterOffset;
    endCarX = endCarStartX;

    // Dropoff car (different color) enters later from the left.
    dropCarY = endCarY;
    dropCarStartX = -END_CAR_W - S(140);
    dropCarStopX = playerCenterX - cabinCenterOffset;
    dropCarX = dropCarStartX;
    dropCarHasPlayer = true;
  }

  function drawEndCar(carX = endCarX, carY = endCarY, hasPlayer = endCarHasPlayer, isDropCar = false) {
    const carW = END_CAR_W;
    const carH = END_CAR_H;
    const roofW = S(52);
    const roofH = S(24);

    // body
    ctx.fillStyle = isDropCar ? '#1565c0' : '#c62828';
    ctx.fillRect(carX, carY + roofH, carW, carH - roofH);
    // roof
    ctx.fillStyle = isDropCar ? '#0d47a1' : '#b71c1c';
    ctx.fillRect(carX + S(42), carY, roofW, roofH);
    // window
    ctx.fillStyle = '#bfe8ff';
    ctx.fillRect(carX + S(47), carY + S(4), roofW - S(12), roofH - S(8));
    // wheels
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(carX + S(22), carY + carH, S(9), 0, Math.PI * 2);
    ctx.arc(carX + carW - S(22), carY + carH, S(9), 0, Math.PI * 2);
    ctx.fill();

    // Player silhouette inside car after pickup.
    if (hasPlayer) {
      ctx.fillStyle = '#000';
      ctx.fillRect(carX + S(66), carY + S(10), S(14), S(14));
    }
  }

  function resizeCanvas() {
    CANVAS_WIDTH = Math.max(640, Math.min(MAX_GAME_WIDTH, Math.floor(window.innerWidth * 0.82)));
    CANVAS_HEIGHT = Math.max(300, Math.min(MAX_GAME_HEIGHT, Math.floor(window.innerHeight * 0.72)));
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    if (!running) {
      player.y = CANVAS_HEIGHT - player.height;
      player.vy = 0;
    }
  }

  let player = { x: PLAYER_START_X, y: CANVAS_HEIGHT - PLAYER_STAND_HEIGHT, width: S(20), height: PLAYER_STAND_HEIGHT, vy: 0 };
  let stepPhase = 0;
  let running = false;
  let gameLoop = null;

  resizeCanvas();
  loadHighScores();

  function draw() {
    baseCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (darkPhaseActive) {
      baseCtx.fillStyle = '#000';
      baseCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    // ground
    ctx.fillStyle = '#654321';
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);

    // score HUD
    ctx.fillStyle = '#111';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('Score: ' + score, HUD_X, HUD_SCORE_Y);
    ctx.font = 'bold 17px monospace';
    ctx.fillText('Daily High: ' + dailyHighScore, HUD_X, HUD_DAILY_Y);

    const athsLabel = showFullATHSLabel
      ? ('All Time High Score: ' + allTimeHighScore)
      : ('A.T.H.S.: ' + allTimeHighScore);
    ctx.fillText(athsLabel, HUD_X, HUD_ATHS_Y);

    // Update click region each frame to match current ATHS label width.
    const athsWidth = ctx.measureText(athsLabel).width;
    athsClickBounds = {
      x: HUD_X,
      y: HUD_ATHS_Y - 16,
      width: athsWidth,
      height: HUD_ATHS_HEIGHT
    };

    const hidePlayer = endSequenceActive && !endPlayerVisible;
    if (!hidePlayer) {
      if (isDashing) {
        // two faint afterimages behind the runner for a stronger sprint feel
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(player.x - S(5), player.y + S(1), player.width, player.width);
        ctx.fillRect(player.x - S(5), player.y + player.width + S(1), player.width, player.width);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(player.x - S(10), player.y + S(2), player.width, player.width);
        ctx.fillRect(player.x - S(10), player.y + player.width + S(2), player.width, player.width);
      }

      // runner: simple two squares for body and head
      // keep body posture neutral (no forced forward lean during sprint)
      const phase = Math.sin(stepPhase);
      const tilt = isDucking ? 0 : 2 * phase;
      ctx.save();
      ctx.translate(player.x + player.width/2, player.y + player.width/2);
      ctx.rotate(tilt * 0.02);
      ctx.translate(-(player.x + player.width/2), -(player.y + player.width/2));
      ctx.fillStyle = '#000';
      if (isDucking && player.y >= CANVAS_HEIGHT - player.height - 1) {
        // crouch pose: low torso, tucked head, and compact back
        const crouchBob = Math.abs(Math.sin(stepPhase * 5)) * S(1.5);
        ctx.fillRect(player.x + S(1), player.y + S(14) + crouchBob, player.width + S(10), S(10));
        ctx.fillRect(player.x + S(11), player.y + S(5) + crouchBob, S(9), S(9));
        ctx.fillRect(player.x + S(4), player.y + S(11) + crouchBob, S(8), S(4));
      } else {
        ctx.fillRect(player.x, player.y, player.width, player.width);
        ctx.fillRect(player.x, player.y + player.width, player.width, player.width);
      }
      ctx.restore();

      // legs + arms
      ctx.fillStyle = '#000';
      const legY = isDucking ? (player.y + player.height - S(10)) : (player.y + player.width * 2); // start below body squares
      const legHeight = S(20);
      const legWidth = S(8);
      const armY = player.y + S(10);
      const armLength = S(16);
      const armWidth = S(5);
      const inAir = player.y < CANVAS_HEIGHT - player.height;

      if (inAir) {
        const rising = player.vy < -1;
        if (rising) {
          // rising pose: simple lunge upward
          const tuck = S(8);
          ctx.fillRect(player.x + S(3) + tuck, legY - S(10), legWidth, legHeight - S(4));
          ctx.fillRect(player.x + player.width - S(3) - legWidth - tuck, legY - S(10), legWidth, legHeight - S(4));
          ctx.fillRect(player.x + S(1), armY - S(14), armWidth, armLength);
          ctx.fillRect(player.x + player.width - S(1) - armWidth, armY - S(14), armWidth, armLength);
        } else {
          // falling pose: simple split lunge downward
          const split = S(9);
          ctx.fillRect(player.x + S(3) + split, legY - S(2), legWidth, legHeight);
          ctx.fillRect(player.x + player.width - S(3) - legWidth - split, legY + S(5), legWidth, legHeight);
          ctx.fillRect(player.x + S(2), armY - S(6), armWidth, armLength);
          ctx.fillRect(player.x + player.width - S(2) - armWidth, armY - S(6), armWidth, armLength);
        }
      } else {
        if (isDucking) {
          // crouching limbs: folded legs + hands close to ground
          const crouchShift = Math.abs(Math.sin(stepPhase * 2.6)) * S(2);
          // short folded legs
          ctx.fillRect(player.x + S(4), legY, legWidth, S(8) + crouchShift);
          ctx.fillRect(player.x + player.width - S(2), legY, legWidth, S(8) + crouchShift);
          // forearms planted near the ground
          ctx.fillRect(player.x + S(7), armY + S(12), armWidth + S(2), S(7));
          ctx.fillRect(player.x + player.width + S(3), armY + S(12), armWidth + S(2), S(7));
        } else if (isDashing) {
          // sprinting pose: faster scissor cycle with visible knee lift
          const sprintPhase = Math.sin(stepPhase * 2.5);
          const sprintSwing = S(10) * sprintPhase;
          const kneeLift = Math.abs(Math.sin(stepPhase * 2.5)) * S(6);

          // left leg drives forward with knee lift
          ctx.fillRect(player.x + S(2) + sprintSwing, legY - kneeLift, legWidth, legHeight - S(2));
          // right leg trails lower behind
          ctx.fillRect(player.x + player.width - S(2) - legWidth - sprintSwing, legY + kneeLift * 0.3, legWidth, legHeight + S(1));

          // arms pump harder while sprinting
          ctx.fillRect(player.x + S(2) - sprintSwing * 0.8, armY - S(1), armWidth, armLength + S(2));
          ctx.fillRect(player.x + player.width - S(2) - armWidth + sprintSwing * 0.8, armY - S(1), armWidth, armLength + S(2));
        } else {
          // normal running pose with swinging limbs
          const swing = S(6) * phase;
          // left leg
          ctx.fillRect(player.x + S(2) + swing, legY, legWidth, legHeight);
          // right leg
          ctx.fillRect(player.x + player.width - S(2) - legWidth - swing, legY, legWidth, legHeight);
          // arms swing opposite legs
          ctx.fillRect(player.x + S(2) - swing, armY, armWidth, armLength);
          ctx.fillRect(player.x + player.width - S(2) - armWidth + swing, armY, armWidth, armLength);
        }
      }

      // dash trail animation drawing
      const dashPulse = 1 + Math.abs(Math.sin(stepPhase * 2.5));
      ctx.strokeStyle = '#000';
      ctx.lineWidth = isDashing ? (1.5 + dashPulse) : 2;
      for (const t of dashTrails) {
        ctx.globalAlpha = t.alpha;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x - t.len, t.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // obstacles: animated dinosaur sprites (facing the player)
    obstacles.forEach(o => {
      const bounce = o.isFlying ? Math.sin(stepPhase * 4 + o.phase) * 2.5 : Math.sin(stepPhase * 2 + o.phase) * 1.8;
      const baseY = o.y + bounce;
      const dinoLegPhase = Math.sin(stepPhase * 3 + o.phase);
      const legLift = Math.abs(dinoLegPhase) * 3;
      const bodyW = Math.floor(o.width * (o.archetype === 'raptor' ? 0.58 : 0.66));
      const bodyH = Math.floor(o.height * 0.36);
      const bodyX = o.x + Math.floor(o.width * 0.2);
      const bodyY = baseY + Math.floor(o.height * (o.isFlying ? 0.24 : 0.34));

      // depth cue: soft shadow under each dino
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      if (o.isFlying) {
        ctx.ellipse(o.x + o.width * 0.48, CANVAS_HEIGHT - 8, o.width * 0.26, 4, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(o.x + o.width * 0.48, CANVAS_HEIGHT - 8, o.width * 0.34, 5, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      if (o.isFlying) {
        // Flying dinosaur (pterodactyl-like)
        const flap = Math.sin(stepPhase * 6 + o.phase) * 7;
        const headW = Math.floor(o.width * 0.2);
        const headH = Math.floor(o.height * 0.16);
        const headX = bodyX - headW;
        const headY = bodyY - 6;

        ctx.fillStyle = o.color;
        // body and head
        ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
        ctx.fillRect(headX, headY, headW, headH);

        // beak facing left
        ctx.beginPath();
        ctx.moveTo(headX, headY + 4);
        ctx.lineTo(headX - 8, headY + 6);
        ctx.lineTo(headX, headY + 8);
        ctx.fill();

        // wings
        ctx.beginPath();
        ctx.moveTo(bodyX + 10, bodyY + 4);
        ctx.lineTo(bodyX + 28, bodyY - 12 - flap);
        ctx.lineTo(bodyX + 40, bodyY + 8);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bodyX + 18, bodyY + 8);
        ctx.lineTo(bodyX + 36, bodyY - 6 - flap * 0.6);
        ctx.lineTo(bodyX + 46, bodyY + 12);
        ctx.fill();

        // eye
        ctx.fillStyle = '#fff';
        ctx.fillRect(headX + 2, headY + 3, 2, 2);
      } else if (o.archetype === 'theropod') {
        // T-Rex / Allosaurus / Carnotaurus / Giganotosaurus
        const headW = Math.floor(o.width * 0.28);
        const headH = Math.floor(o.height * 0.24);
        const headX = bodyX - headW + 2;
        const headY = bodyY - Math.floor(headH * 0.75);

        ctx.fillStyle = o.color;
        // tail
        ctx.beginPath();
        ctx.moveTo(bodyX + bodyW - 2, bodyY + 8);
        ctx.lineTo(bodyX + bodyW + 12, bodyY + 4);
        ctx.lineTo(bodyX + bodyW - 2, bodyY + 16);
        ctx.fill();

        // body + head
        ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
        ctx.fillRect(headX, headY, headW, headH);

        // tiny T-Rex arms
        ctx.fillRect(bodyX + 8, bodyY + 8, 5, 3);
        ctx.fillRect(bodyX + 12, bodyY + 13, 5, 3);

        // strong hind legs
        const legY = baseY + o.height - 15;
        const legW = Math.max(5, Math.floor(o.width * 0.13));
        ctx.fillRect(bodyX + 10, legY - legLift, legW, 15 + legLift);
        ctx.fillRect(bodyX + bodyW - 18, legY - (3 - legLift), legW, 15 + (3 - legLift));

        // eye
        ctx.fillStyle = '#fff';
        ctx.fillRect(headX + 2, headY + 4, 3, 3);
      } else if (o.archetype === 'longneck') {
        // Brachiosaurus / Diplodocus / Argentinosaurus
        const neckW = Math.floor(o.width * 0.12);
        const neckH = Math.floor(o.height * 0.32);
        const neckX = bodyX - 4;
        const neckY = bodyY - neckH + 4;
        const headW = Math.floor(o.width * 0.16);
        const headH = Math.floor(o.height * 0.14);
        const headX = neckX - headW + 4;
        const headY = neckY - 2;

        ctx.fillStyle = o.color;
        // long tail
        ctx.beginPath();
        ctx.moveTo(bodyX + bodyW, bodyY + 8);
        ctx.lineTo(bodyX + bodyW + 18, bodyY + 2);
        ctx.lineTo(bodyX + bodyW, bodyY + 14);
        ctx.fill();

        // body + neck + head
        ctx.fillRect(bodyX, bodyY + 3, bodyW + 4, bodyH - 3);
        ctx.fillRect(neckX, neckY, neckW, neckH);
        ctx.fillRect(headX, headY, headW, headH);

        // 4 chunky legs
        const legY = baseY + o.height - 14;
        const legW = Math.max(4, Math.floor(o.width * 0.1));
        ctx.fillRect(bodyX + 6, legY - legLift * 0.5, legW, 14 + legLift * 0.5);
        ctx.fillRect(bodyX + 16, legY - 2, legW, 16);
        ctx.fillRect(bodyX + bodyW - 20, legY - legLift * 0.5, legW, 14 + legLift * 0.5);
        ctx.fillRect(bodyX + bodyW - 10, legY - 2, legW, 16);

        // eye
        ctx.fillStyle = '#fff';
        ctx.fillRect(headX + 2, headY + 3, 2, 2);
      } else if (o.archetype === 'horned') {
        // Triceratops / Iguanodon
        const headW = Math.floor(o.width * 0.3);
        const headH = Math.floor(o.height * 0.24);
        const headX = bodyX - headW + 8;
        const headY = bodyY - Math.floor(headH * 0.35);

        ctx.fillStyle = o.color;
        // tail
        ctx.beginPath();
        ctx.moveTo(bodyX + bodyW, bodyY + 10);
        ctx.lineTo(bodyX + bodyW + 10, bodyY + 8);
        ctx.lineTo(bodyX + bodyW, bodyY + 15);
        ctx.fill();

        // body + head
        ctx.fillRect(bodyX, bodyY + 2, bodyW, bodyH);
        ctx.fillRect(headX, headY, headW, headH);

        // frill
        ctx.fillStyle = '#111';
        ctx.fillRect(headX + headW - 4, headY + 1, 6, headH - 2);

        // horns (pointing left)
        ctx.beginPath();
        ctx.moveTo(headX + 2, headY + 6);
        ctx.lineTo(headX - 8, headY + 4);
        ctx.lineTo(headX + 2, headY + 9);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(headX + 2, headY + 12);
        ctx.lineTo(headX - 7, headY + 13);
        ctx.lineTo(headX + 2, headY + 15);
        ctx.fill();

        // legs
        ctx.fillStyle = o.color;
        const legY = baseY + o.height - 14;
        const legW = Math.max(4, Math.floor(o.width * 0.11));
        ctx.fillRect(bodyX + 8, legY - legLift, legW, 14 + legLift);
        ctx.fillRect(bodyX + bodyW - 14, legY - (3 - legLift), legW, 14 + (3 - legLift));

        // eye
        ctx.fillStyle = '#fff';
        ctx.fillRect(headX + 5, headY + 5, 2, 2);
      } else if (o.archetype === 'armored') {
        // Stegosaurus / Ankylosaurus / Pachycephalosaurus
        const headW = Math.floor(o.width * 0.2);
        const headH = Math.floor(o.height * 0.18);
        const headX = bodyX - headW + 4;
        const headY = bodyY + 2;

        ctx.fillStyle = o.color;
        ctx.fillRect(bodyX, bodyY + 4, bodyW, bodyH);
        ctx.fillRect(headX, headY, headW, headH);

        // armor plates
        ctx.fillStyle = '#111';
        for (let s = 0; s < 4; s++) {
          const sx = bodyX + 6 + s * 10;
          ctx.beginPath();
          ctx.moveTo(sx, bodyY + 4);
          ctx.lineTo(sx + 4, bodyY - 8);
          ctx.lineTo(sx + 8, bodyY + 4);
          ctx.fill();
        }

        // legs
        ctx.fillStyle = o.color;
        const legY = baseY + o.height - 14;
        const legW = Math.max(4, Math.floor(o.width * 0.11));
        ctx.fillRect(bodyX + 8, legY - legLift * 0.5, legW, 14 + legLift * 0.5);
        ctx.fillRect(bodyX + bodyW - 14, legY - (2 - legLift * 0.5), legW, 14 + (2 - legLift * 0.5));
      } else if (o.archetype === 'sail') {
        // Spinosaurus / Parasaurolophus
        const headW = Math.floor(o.width * 0.24);
        const headH = Math.floor(o.height * 0.2);
        const headX = bodyX - headW + 4;
        const headY = bodyY - 4;

        ctx.fillStyle = o.color;
        ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
        ctx.fillRect(headX, headY, headW, headH);

        // sail/crest
        ctx.fillStyle = '#111';
        for (let s = 0; s < 5; s++) {
          const sx = bodyX + 6 + s * 7;
          ctx.fillRect(sx, bodyY - 10 - (s % 2) * 3, 3, 12 + (s % 2) * 3);
        }

        // legs
        ctx.fillStyle = o.color;
        const legY = baseY + o.height - 14;
        const legW = Math.max(4, Math.floor(o.width * 0.11));
        ctx.fillRect(bodyX + 8, legY - legLift, legW, 14 + legLift);
        ctx.fillRect(bodyX + bodyW - 14, legY - (3 - legLift), legW, 14 + (3 - legLift));
      } else if (o.archetype === 'raptor') {
        // Velociraptor / Deinonychus / Oviraptor / Utahraptor
        const headW = Math.floor(o.width * 0.2);
        const headH = Math.floor(o.height * 0.16);
        const headX = bodyX - headW + 4;
        const headY = bodyY - 6;

        ctx.fillStyle = o.color;
        ctx.fillRect(bodyX, bodyY + 4, bodyW, bodyH - 4);
        ctx.fillRect(headX, headY, headW, headH);

        // long raptor tail
        ctx.beginPath();
        ctx.moveTo(bodyX + bodyW, bodyY + 8);
        ctx.lineTo(bodyX + bodyW + 18, bodyY + 6);
        ctx.lineTo(bodyX + bodyW, bodyY + 12);
        ctx.fill();

        // quick legs
        const legY = baseY + o.height - 12;
        const legW = Math.max(3, Math.floor(o.width * 0.09));
        ctx.fillRect(bodyX + 8, legY - legLift * 1.2, legW, 12 + legLift * 1.2);
        ctx.fillRect(bodyX + bodyW - 10, legY - (3 - legLift * 1.2), legW, 12 + (3 - legLift * 1.2));
      } else {
        // Therizinosaurus (clawed)
        const headW = Math.floor(o.width * 0.22);
        const headH = Math.floor(o.height * 0.18);
        const headX = bodyX - headW + 4;
        const headY = bodyY - 4;

        ctx.fillStyle = o.color;
        ctx.fillRect(bodyX, bodyY + 2, bodyW, bodyH);
        ctx.fillRect(headX, headY, headW, headH);

        // long claws
        ctx.fillStyle = '#111';
        ctx.fillRect(bodyX + 10, bodyY + 10, 8, 2);
        ctx.fillRect(bodyX + 10, bodyY + 14, 8, 2);

        const legY = baseY + o.height - 14;
        const legW = Math.max(4, Math.floor(o.width * 0.1));
        ctx.fillStyle = o.color;
        ctx.fillRect(bodyX + 8, legY - legLift * 0.7, legW, 14 + legLift * 0.7);
        ctx.fillRect(bodyX + bodyW - 12, legY - (2 - legLift * 0.7), legW, 14 + (2 - legLift * 0.7));
      }

      // subtle shading and outline to make sprites look cleaner
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bodyX + 2, bodyY + 2, Math.max(4, bodyW - 8), Math.max(3, Math.floor(bodyH * 0.35)));
      ctx.strokeStyle = '#101010';
      ctx.lineWidth = 1;
      ctx.strokeRect(bodyX, bodyY, bodyW, bodyH);
    });

    if (endSequenceActive) {
      if (endSequencePhase === 'pickup') {
        drawEndCar(endCarX, endCarY, endCarHasPlayer, false);
      } else if (endSequencePhase === 'dropoff') {
        drawEndCar(dropCarX, dropCarY, dropCarHasPlayer, true);
      }

      if (endSequencePhase === 'title') {
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 72px monospace';
        ctx.fillText('THE END', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - S(24));
        ctx.font = 'bold 42px monospace';
        ctx.fillText('By: Bohdan L.', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + S(28));
        ctx.restore();
      }
    }
  }

  function update() {
    // always advance step phase so legs animate even if game hasn't started
    stepPhase += 0.2;
    if (!running) {
      draw();
      return;
    }

    if (endSequenceActive) {
      const elapsed = Date.now() - endSequenceStartMs;

      if (endSequencePhase === 'pickup') {
        if (elapsed <= END_CAR_APPROACH_MS) {
          const t = elapsed / END_CAR_APPROACH_MS;
          endCarX = endCarStartX + (endCarStopX - endCarStartX) * t;
        } else if (elapsed <= END_CAR_APPROACH_MS + END_CAR_STOP_MS) {
          endCarX = endCarStopX;
          // Hide player only after a short dwell so pickup is visibly shown.
          const pickupDelayMs = 450;
          if (elapsed >= END_CAR_APPROACH_MS + pickupDelayMs) {
            endPlayerVisible = false;
            endCarHasPlayer = true;
          }
        } else {
          endCarX += S(6);
          if (endCarX > CANVAS_WIDTH + END_CAR_W + S(40)) {
            endSequencePhase = 'title';
            endSequenceStartMs = Date.now();
          }
        }
      } else if (endSequencePhase === 'title') {
        if (elapsed >= END_TITLE_DURATION_MS) {
          // Reset for the second cinematic before gameplay resumes.
          score = 0;
          scoreTick = 0;
          nextDarkPhaseScore = 1000;
          obstacles = [];
          obstacleTimer = 0;
          isDashing = false;
          isDucking = false;
          dashTrails = [];
          dashTrailTick = 0;
          player.vy = 0;
          player.height = PLAYER_STAND_HEIGHT;
          player.y = CANVAS_HEIGHT - player.height;
          player.x = PLAYER_START_X;
          endPlayerVisible = false;

          endSequencePhase = 'dropoff';
          endSequenceStartMs = Date.now();
          dropCarX = dropCarStartX;
          dropCarHasPlayer = true;
        }
      } else if (endSequencePhase === 'dropoff') {
        if (elapsed <= END_DROP_CAR_APPROACH_MS) {
          const t = elapsed / END_DROP_CAR_APPROACH_MS;
          dropCarX = dropCarStartX + (dropCarStopX - dropCarStartX) * t;
        } else if (elapsed <= END_DROP_CAR_APPROACH_MS + END_DROP_CAR_STOP_MS) {
          dropCarX = dropCarStopX;
          // Player appears during the stop as if dropped off.
          if (elapsed >= END_DROP_CAR_APPROACH_MS + 320) {
            endPlayerVisible = true;
            dropCarHasPlayer = false;
            player.vy = 0;
            player.height = PLAYER_STAND_HEIGHT;
            player.y = CANVAS_HEIGHT - player.height;
            player.x = PLAYER_START_X;
          }
        } else {
          dropCarX += END_DROP_CAR_EXIT_SPEED;
          if (dropCarX > CANVAS_WIDTH + END_CAR_W + S(40)) {
            endSequenceActive = false;
            endSequencePhase = 'pickup';
            running = true;
          }
        }
      }

      // Ensure normal visuals during ending sequence.
      darkPhaseActive = false;

      draw();
      return;
    }

    player.vy += GRAVITY;
    player.y += player.vy;
    if (player.y > CANVAS_HEIGHT - player.height) {
      player.y = CANVAS_HEIGHT - player.height;
      player.vy = 0;
    }

    // keep hitbox in sync with duck key state when on ground
    if (player.y >= CANVAS_HEIGHT - player.height - 1) {
      if (isDucking && player.height !== PLAYER_DUCK_HEIGHT) {
        player.y += (PLAYER_STAND_HEIGHT - PLAYER_DUCK_HEIGHT);
        player.height = PLAYER_DUCK_HEIGHT;
      } else if (!isDucking && player.height !== PLAYER_STAND_HEIGHT) {
        player.y -= (PLAYER_STAND_HEIGHT - PLAYER_DUCK_HEIGHT);
        player.height = PLAYER_STAND_HEIGHT;
      }
    }

    // update dash trails animation
    for (let i = dashTrails.length - 1; i >= 0; i--) {
      const t = dashTrails[i];
      t.x += 2; // shorter trail movement so animation stays tighter
      t.alpha -= 0.1; // fade faster so it does not stretch too long
      if (t.alpha <= 0) dashTrails.splice(i, 1);
    }
    // if still dashing, spawn more trails each update to animate
    if (isDashing) {
      dashTrailTick++;
      if (dashTrailTick % DASH_TRAIL_SPAWN_RATE === 0) {
        const yPos = player.y + player.height/2;
        const wobble = Math.sin(stepPhase * 3) * 1.5;
        dashTrails.push({ x: player.x - DASH_TRAIL_X_OFFSET, y: yPos - DASH_TRAIL_Y_OFFSET - 6 + wobble, len: DASH_TRAIL_SHORT, alpha: 1 });
        dashTrails.push({ x: player.x - DASH_TRAIL_X_OFFSET, y: yPos - DASH_TRAIL_Y_OFFSET + wobble, len: DASH_TRAIL_LONG, alpha: 1 });
        dashTrails.push({ x: player.x - DASH_TRAIL_X_OFFSET, y: yPos - DASH_TRAIL_Y_OFFSET + 6 + wobble, len: DASH_TRAIL_SHORT, alpha: 1 });
      }
    }

    // obstacles movement - speed increases during dash
    const speed = isDashing ? OBSTACLE_SPEED * DASH_SPEED_MULT : OBSTACLE_SPEED;
    obstacleTimer++;
    if (obstacleTimer >= OBSTACLE_INTERVAL) {
      obstacleTimer = 0;

      // random pack size per wave (1-2 dinos)
      const roll = Math.random();
      const spawnCount = roll < 0.35 ? 1 : 2;
      let spawnX = CANVAS_WIDTH;
      for (let i = 0; i < spawnCount; i++) {
        const species = DINO_SPECIES[Math.floor(Math.random() * DINO_SPECIES.length)];
        const isFlying = !!species.isFlying;

        let h = S(46) + Math.random() * S(20);
        let w = S(58) + Math.random() * S(18);
        if (species.archetype === 'flying') {
          h = S(30) + Math.random() * S(14);
          w = S(56) + Math.random() * S(16);
        } else if (species.archetype === 'longneck') {
          h = S(56) + Math.random() * S(18);
          w = S(72) + Math.random() * S(20);
        } else if (species.archetype === 'raptor') {
          h = S(40) + Math.random() * S(16);
          w = S(52) + Math.random() * S(16);
        }

        const archetypeColors = {
          theropod: ['#4e342e', '#6d4c41', '#5d4037'],
          longneck: ['#8d6e63', '#795548', '#a1887f'],
          horned: ['#2e7d32', '#33691e', '#558b2f'],
          armored: ['#455a64', '#546e7a', '#607d8b'],
          sail: ['#00796b', '#00695c', '#00897b'],
          raptor: ['#37474f', '#455a64', '#546e7a'],
          clawed: ['#6d4c41', '#5d4037', '#4e342e'],
          flying: ['#5d4037', '#4e342e', '#6d4c41']
        };
        const colors = archetypeColors[species.archetype] || ['#2e7d32', '#558b2f', '#6d4c41'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const y = isFlying
          ? (CANVAS_HEIGHT - GROUND_HEIGHT - h - (85 + Math.random() * 40))
          : (CANVAS_HEIGHT - h);
        obstacles.push({
          x: spawnX,
          y,
          width: w,
          height: h,
          color,
          phase: Math.random() * Math.PI * 2,
          species: species.name,
          archetype: species.archetype,
          isFlying
        });

        // keep enough spacing so jumps are possible even in 3-dino packs
        spawnX += w + 70 + Math.random() * 50;
      }
    }
    obstacles.forEach(o => {
      o.x -= speed;
    });
    obstacles = obstacles.filter(o => o.x + o.width > 0);

    // collision
    for (const o of obstacles) {
      const obstacleY = o.y;
      if (
        player.x < o.x + o.width &&
        player.x + player.width > o.x &&
        player.y < obstacleY + o.height &&
        player.y + player.height > obstacleY
      ) {
        endGame();
        break;
      }
    }
    draw();
  }

  function jump() {
    if (player.y >= CANVAS_HEIGHT - player.height - 1) {
      player.vy = JUMP_VELOCITY;
    }
  }

  function startGame() {
    overlay.classList.add('hidden');
    running = true;
    score = 0;
    scoreTick = 0;
    nextDarkPhaseScore = 1000;
    darkPhaseActive = false;
    endSequenceActive = false;
    endSequencePhase = 'pickup';
    endPlayerVisible = true;
    endCarHasPlayer = false;
    dropCarHasPlayer = true;
    gKeyDown = false;
    fKeyDown = false;
    gfComboLatched = false;
    bKeyDown = false;
    lKeyDown = false;
    blComboLatched = false;
    if (darkPhaseTimer) {
      clearTimeout(darkPhaseTimer);
      darkPhaseTimer = null;
    }
    obstacles = [];
    obstacleTimer = 0;
    isDashing = false;
    isDucking = false;
    dashTrails = [];
    dashTrailTick = 0;
    player.x = PLAYER_START_X;
    player.height = PLAYER_STAND_HEIGHT;
    player.y = CANVAS_HEIGHT - player.height;
    player.vy = 0;
  }

  function endGame() {
    running = false;
    updateHighScoresIfNeeded();
    overlay.textContent = 'Game Over - Score: ' + score + ' - click or press Space to restart';
    overlay.classList.remove('hidden');
  }

  function isInsideRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'g' || e.key === 'G') gKeyDown = true;
    if (e.key === 'f' || e.key === 'F') fKeyDown = true;
    if (e.key === 'b' || e.key === 'B') bKeyDown = true;
    if (e.key === 'l' || e.key === 'L') lKeyDown = true;

    if (bKeyDown && lKeyDown && !blComboLatched) {
      // hidden shortcut: reset all-time high score (A.T.H.S.)
      blComboLatched = true;
      if (highScoreSyncTimer) {
        clearTimeout(highScoreSyncTimer);
        highScoreSyncTimer = null;
      }
      allTimeHighScore = 0;
      persistAllTimeHigh();
      resetAllTimeHighInDb();
      draw();
    }

    if (running && !endSequenceActive && gKeyDown && fKeyDown && !gfComboLatched) {
      // hidden shortcut: jump straight to ending score/sequence
      gfComboLatched = true;
      score = END_SCORE;
      updateHighScoresIfNeeded();
      triggerEndSequence();
      return;
    }

    if (running) {
      if (endSequenceActive) {
        e.preventDefault();
        return;
      }
      if ([' ', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        jump();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        isDucking = true;
        if (player.y >= CANVAS_HEIGHT - player.height - 1 && player.height !== PLAYER_DUCK_HEIGHT) {
          player.y += (PLAYER_STAND_HEIGHT - PLAYER_DUCK_HEIGHT);
          player.height = PLAYER_DUCK_HEIGHT;
        }
      }
      if (e.key === 'ArrowRight' && !isDashing) {
        // initiate sprint while right arrow is held
        isDashing = true;
        dashTrailTick = 0;
        // spawn initial trails
        const yPos = player.y + player.height/2;
        dashTrails.push({ x: player.x - DASH_TRAIL_X_OFFSET, y: yPos - DASH_TRAIL_Y_OFFSET - 6, len: DASH_TRAIL_SHORT, alpha: 1 });
        dashTrails.push({ x: player.x - DASH_TRAIL_X_OFFSET, y: yPos - DASH_TRAIL_Y_OFFSET, len: DASH_TRAIL_LONG, alpha: 1 });
        dashTrails.push({ x: player.x - DASH_TRAIL_X_OFFSET, y: yPos - DASH_TRAIL_Y_OFFSET + 6, len: DASH_TRAIL_SHORT, alpha: 1 });
      }
    } else {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startGame();
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'g' || e.key === 'G') gKeyDown = false;
    if (e.key === 'f' || e.key === 'F') fKeyDown = false;
    if (!gKeyDown || !fKeyDown) gfComboLatched = false;
    if (e.key === 'b' || e.key === 'B') bKeyDown = false;
    if (e.key === 'l' || e.key === 'L') lKeyDown = false;
    if (!bKeyDown || !lKeyDown) blComboLatched = false;

    if (e.key === 'ArrowRight') {
      isDashing = false;
    }
    if (e.key === 'ArrowDown') {
      isDucking = false;
      if (player.y >= CANVAS_HEIGHT - player.height - 1 && player.height !== PLAYER_STAND_HEIGHT) {
        player.y -= (PLAYER_STAND_HEIGHT - PLAYER_DUCK_HEIGHT);
        player.height = PLAYER_STAND_HEIGHT;
      }
    }
  });

  window.addEventListener('blur', () => {
    isDashing = false;
    isDucking = false;
    if (player.height !== PLAYER_STAND_HEIGHT && player.y >= CANVAS_HEIGHT - player.height - 1) {
      player.y -= (PLAYER_STAND_HEIGHT - PLAYER_DUCK_HEIGHT);
      player.height = PLAYER_STAND_HEIGHT;
    }
  });

  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousedown', () => {
    if (!running) startGame();
  });
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    if (isInsideRect(x, y, athsClickBounds)) {
      showFullATHSLabel = !showFullATHSLabel;
      draw();
      return;
    }

    if (running) jump();
  });

  // initial draw
  draw();
  // always run the update loop
  gameLoop = setInterval(update, 1000 / 60);
  // score ticks every 10ms while game is running (not during ending cinematic)
  scoreTimer = setInterval(() => {
    if (running && !endSequenceActive) {
      scoreTick++;
      // slower global score gain for both running and dashing
      if (scoreTick % 4 === 0) {
        score += 1; // every 40ms
        updateHighScoresIfNeeded();
        if (!endSequenceActive && score >= END_SCORE) {
          score = END_SCORE;
          triggerEndSequence();
          return;
        }
        if (score >= nextDarkPhaseScore) {
          triggerDarkPhase();
          while (score >= nextDarkPhaseScore) {
            nextDarkPhaseScore += 1000;
          }
        }
      }
    }
  }, 10);
  // start automatically so user doesn't have to press anything
  startGame();
})();