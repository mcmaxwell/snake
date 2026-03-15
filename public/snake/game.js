(() => {
  const GRID_SIZE = 30;
  const CELL_SIZE = 20;
  const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
  const START_SPEED = 150;
  const MIN_SPEED = 60;
  const SPEED_DECREASE = 2;
  const APPLE_SCORE = 100;
  const BONUS_SCORE = 300;
  const BONUS_INTERVAL = 20000; // 20 seconds
  const BONUS_DURATION = 6500;  // 6.5 seconds
  const SPEED_BOOST_DURATION = 6700;
  const SPEED_BOOST_PER_PICKUP = 3; // permanent small speed increase (ms per tick)

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMessage = document.getElementById('overlay-message');
  const playerNameInput = document.getElementById('player-name');
  const startBtn = document.getElementById('start-btn');
  const scoreDisplay = document.getElementById('current-score');
  const leaderboardList = document.getElementById('leaderboard-list');

  let snake = [];
  let apple = null;
  let bonuses = []; // [{ x, y, expiresAt }]
  let speedBoosts = []; // [{ x, y, expiresAt }]
  let direction = { x: 1, y: 0 };
  let nextDirection = { x: 1, y: 0 };
  let score = 0;
  let applesEaten = 0;
  let growthLeft = 0;
  let speed = START_SPEED;
  let gameLoop = null;
  let bonusSpawnTimer = null;
  let running = false;
  let speedBoostStacks = 0;
  let nextSpeedBoostScore = 1000;
  let playerName = '';
  let currentPlayerName = '';

  // Load saved name
  const savedName = localStorage.getItem('snakePlayerName');
  if (savedName) {
    playerNameInput.value = savedName;
  }

  // --- Leaderboard ---

  async function fetchLeaderboard() {
    try {
      const res = await fetch('/api/scores?limit=10');
      const scores = await res.json();
      renderLeaderboard(scores);
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
    }
  }

  function renderLeaderboard(scores) {
    leaderboardList.innerHTML = '';
    if (scores.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-msg';
      li.textContent = 'No scores yet';
      leaderboardList.appendChild(li);
      return;
    }
    scores.forEach(entry => {
      const li = document.createElement('li');
      if (entry.player_name === currentPlayerName) {
        li.classList.add('highlight');
      }
      const nameSpan = document.createElement('span');
      nameSpan.className = 'lb-name';
      nameSpan.textContent = entry.player_name;
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'lb-score';
      scoreSpan.textContent = entry.score;
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      leaderboardList.appendChild(li);
    });
  }

  async function submitScore(name, playerScore) {
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: name, score: playerScore })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Failed to submit score:', e);
      return null;
    }
  }

  // --- Game Logic ---

  function getOccupied() {
    const set = new Set(snake.map(s => `${s.x},${s.y}`));
    if (apple) set.add(`${apple.x},${apple.y}`);
    for (const b of bonuses) set.add(`${b.x},${b.y}`);
    for (const sb of speedBoosts) set.add(`${sb.x},${sb.y}`);
    return set;
  }

  function getFreeCells(extraOccupied) {
    const occupied = extraOccupied || getOccupied();
    const free = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!occupied.has(`${x},${y}`)) {
          free.push({ x, y });
        }
      }
    }
    return free;
  }

  function initGame() {
    const centerX = Math.floor(GRID_SIZE / 2);
    const centerY = Math.floor(GRID_SIZE / 2);
    snake = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    applesEaten = 0;
    growthLeft = 0;
    speed = START_SPEED;
    bonuses = [];
    speedBoosts = [];
    speedBoostStacks = 0;
    nextSpeedBoostScore = 1000;
    scoreDisplay.textContent = '0';
    clearBonusTimers();
    spawnApple();
  }

  function spawnApple() {
    const free = getFreeCells();
    if (free.length === 0) {
      apple = null;
      return;
    }
    apple = free[Math.floor(Math.random() * free.length)];
  }

  function spawnBonus() {
    const free = getFreeCells();
    if (free.length === 0) return;
    const spot = free[Math.floor(Math.random() * free.length)];
    bonuses.push({ ...spot, expiresAt: Date.now() + BONUS_DURATION });
  }

  function spawnSpeedBoost() {
    const free = getFreeCells();
    if (free.length === 0) return;
    const spot = free[Math.floor(Math.random() * free.length)];
    speedBoosts.push({ ...spot, expiresAt: Date.now() + SPEED_BOOST_DURATION });
  }

  function getCurrentTickInterval() {
    const boosted = speed - (speedBoostStacks * SPEED_BOOST_PER_PICKUP);
    return Math.max(35, boosted);
  }

  function restartGameLoop() {
    if (!running) return;
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(update, getCurrentTickInterval());
  }

  function clearBonusTimers() {
    if (bonusSpawnTimer) { clearInterval(bonusSpawnTimer); bonusSpawnTimer = null; }
  }

  function startBonusCycle() {
    bonusSpawnTimer = setInterval(() => {
      if (running) {
        spawnBonus();
      }
    }, BONUS_INTERVAL);
  }

  function update() {
    const now = Date.now();
    bonuses = bonuses.filter(b => b.expiresAt > now);
    speedBoosts = speedBoosts.filter(sb => sb.expiresAt > now);

    direction = { ...nextDirection };

    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    };

    // Wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      gameOver();
      return;
    }

    // Self collision
    for (const seg of snake) {
      if (seg.x === head.x && seg.y === head.y) {
        gameOver();
        return;
      }
    }

    snake.unshift(head);

    // Apple eaten
    if (apple && head.x === apple.x && head.y === apple.y) {
      score += APPLE_SCORE;
      applesEaten++;
      growthLeft += 1;
      scoreDisplay.textContent = score;
      speed = Math.max(MIN_SPEED, START_SPEED - applesEaten * SPEED_DECREASE);
      spawnApple();
      // Restart loop with new speed
      restartGameLoop();
    }

    // Bonus eaten
    const bonusIndex = bonuses.findIndex(b => head.x === b.x && head.y === b.y);
    if (bonusIndex >= 0) {
      score += BONUS_SCORE;
      growthLeft += 3;
      scoreDisplay.textContent = score;
      bonuses.splice(bonusIndex, 1);
    }

    // Spawn a speed boost each time score passes a 1000-point milestone.
    while (score >= nextSpeedBoostScore) {
        spawnSpeedBoost();
        nextSpeedBoostScore += 1000;
    }

    // Speed boost eaten
    const speedBoostIndex = speedBoosts.findIndex(sb => head.x === sb.x && head.y === sb.y);
    if (speedBoostIndex >= 0) {
      speedBoosts.splice(speedBoostIndex, 1);
      speedBoostStacks += 1;
      restartGameLoop();
    }

    if (growthLeft > 0) {
      growthLeft--;
    } else {
      snake.pop();
    }

    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const animTime = performance.now() / 1000;

    // Draw grid lines (subtle)
    ctx.strokeStyle = '#1a2240';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw apple
    if (apple) {
      const cx = apple.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = apple.y * CELL_SIZE + CELL_SIZE / 2;
      const pulse = 0.88 + Math.sin(animTime * 5.2) * 0.12;
      const r = (CELL_SIZE / 2 - 2) * pulse;

      ctx.save();
      // Soft glow pulse around apple.
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(animTime * 5.2)) * 0.2;
      ctx.fillStyle = '#ff6b5e';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Stem
      ctx.fillStyle = '#5a3b1f';
      ctx.fillRect(cx - 1, cy - r - 2, 2, 5);

      // Leaf
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.ellipse(cx + 4, cy - r + 1, 4, 2.2, -0.45, 0, Math.PI * 2);
      ctx.fill();

      // Tiny highlight so pulse reads better.
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.32, cy - r * 0.32, Math.max(2, r * 0.22), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw bonus (animated golden star)
    for (const bonus of bonuses) {
      const bx = bonus.x * CELL_SIZE + CELL_SIZE / 2;
      const by = bonus.y * CELL_SIZE + CELL_SIZE / 2;
      const spin = animTime * 4.2;
      const pulse = 0.82 + Math.abs(Math.sin(animTime * 6.4)) * 0.24;
      const outerR = (CELL_SIZE / 2 - 2) * pulse;
      const innerR = outerR * 0.48;

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(spin);

      // Glow effect
      ctx.globalAlpha = 0.4 + Math.abs(Math.sin(animTime * 6.4)) * 0.25;
      ctx.fillStyle = '#ffe55a';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (-Math.PI / 2) + i * (Math.PI / 4);
        const rr = i % 2 === 0 ? outerR + 2 : innerR + 2;
        const x = Math.cos(angle) * rr;
        const y = Math.sin(angle) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Core star
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (-Math.PI / 2) + i * (Math.PI / 4);
        const rr = i % 2 === 0 ? outerR : innerR;
        const x = Math.cos(angle) * rr;
        const y = Math.sin(angle) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Bright center sparkle
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(-outerR * 0.12, -outerR * 0.12, Math.max(1.6, outerR * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw speed boost (Mercury-inspired winged boot with blue/yellow outline)
    for (const speedBoost of speedBoosts) {
      const sx = speedBoost.x * CELL_SIZE + CELL_SIZE / 2;
      const sy = speedBoost.y * CELL_SIZE + CELL_SIZE / 2;
      const flap = Math.sin(animTime * 10) * 1.8;
      const bob = Math.sin(animTime * 4.8 + speedBoost.x * 0.7) * 1.2;

      ctx.save();
      ctx.translate(sx, sy + bob);
      ctx.rotate(-0.1 + Math.sin(animTime * 3.6) * 0.03);

      // Wing glow aura
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(animTime * 8)) * 0.2;
      ctx.fillStyle = '#8ac6ff';
      ctx.beginPath();
      ctx.ellipse(0, 0, CELL_SIZE * 0.52, CELL_SIZE * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Sandal boot body (Mercury vibe)
      ctx.fillStyle = '#6fb8ff';
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, -5);
      ctx.lineTo(2, -6);
      ctx.lineTo(7, -3);
      ctx.lineTo(8, 1);
      ctx.lineTo(6, 5);
      ctx.lineTo(1, 6);
      ctx.lineTo(-8, 5);
      ctx.lineTo(-9, 1);
      ctx.lineTo(-8, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sole + strap accents
      ctx.fillStyle = '#2f7fd4';
      ctx.fillRect(-8, 4, 14, 2);
      ctx.strokeStyle = '#ffe680';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-5, -2);
      ctx.lineTo(4, -2.5);
      ctx.moveTo(-4, 0.5);
      ctx.lineTo(5, 0);
      ctx.stroke();

      // Wing (left)
      ctx.fillStyle = '#dff3ff';
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-8, -1);
      ctx.lineTo(-13 - flap * 0.8, -5);
      ctx.lineTo(-12 - flap * 0.4, -1);
      ctx.lineTo(-15 - flap * 1.1, 2);
      ctx.lineTo(-9, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wing (right, smaller hint)
      ctx.beginPath();
      ctx.moveTo(4, -2);
      ctx.lineTo(7 + flap * 0.5, -4);
      ctx.lineTo(6 + flap * 0.25, -1);
      ctx.lineTo(8 + flap * 0.7, 1);
      ctx.lineTo(5, 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wing feather detail
      ctx.strokeStyle = '#8abfff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-10, -1);
      ctx.lineTo(-13 - flap * 0.7, -3);
      ctx.moveTo(-10, 1);
      ctx.lineTo(-13 - flap * 0.7, 1);
      ctx.stroke();

      ctx.restore();
    }

    // Draw snake (gradient: bright head → darker tail)
    snake.forEach((seg, i) => {
      const isHead = i === 0;
      // Gradient: head is #00A86B, tail gets darker
      const baseColor = { r: 0, g: 168, b: 107 };
      const t = snake.length > 1 ? i / (snake.length - 1) : 0;
      // Darken by reducing green and blue as t increases
      const r = baseColor.r;
      const g = Math.round(baseColor.g * (1 - 0.35 * t)); // up to 35% darker
      const b = Math.round(baseColor.b * (1 - 0.35 * t));
      let fillColor = `rgb(${r},${g},${b})`;
      ctx.fillStyle = fillColor;
      const padding = 1;
      ctx.fillRect(
        seg.x * CELL_SIZE + padding,
        seg.y * CELL_SIZE + padding,
        CELL_SIZE - padding * 2,
        CELL_SIZE - padding * 2
      );
      if (isHead) {
        // Eyes
        ctx.fillStyle = '#1a1a2e';
        const eyeSize = 3;
        let eye1x, eye1y, eye2x, eye2y;
        const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;
        if (direction.x === 1) {
          eye1x = cx + 4; eye1y = cy - 4;
          eye2x = cx + 4; eye2y = cy + 4;
        } else if (direction.x === -1) {
          eye1x = cx - 4; eye1y = cy - 4;
          eye2x = cx - 4; eye2y = cy + 4;
        } else if (direction.y === -1) {
          eye1x = cx - 4; eye1y = cy - 4;
          eye2x = cx + 4; eye2y = cy - 4;
        } else {
          eye1x = cx - 4; eye1y = cy + 4;
          eye2x = cx + 4; eye2y = cy + 4;
        }
        ctx.beginPath();
        ctx.arc(eye1x, eye1y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2x, eye2y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  let pendingScore = null;

  async function gameOver() {
    running = false;
    clearInterval(gameLoop);
    clearBonusTimers();
    bonuses = [];
    speedBoosts = [];
    speedBoostStacks = 0;

    pendingScore = score;

    overlayTitle.textContent = 'Game Over';
    overlayMessage.textContent = `Score: ${score}`;
    playerNameInput.style.display = '';
    playerNameInput.value = localStorage.getItem('snakePlayerName') || '';
    startBtn.textContent = 'Submit Score';
    overlay.classList.remove('hidden');
    playerNameInput.focus();
  }

  async function submitAndRestart() {
    const name = playerNameInput.value.trim();
    if (!name || !/^[a-zA-Z0-9_]+$/.test(name) || name.length > 20) {
      playerNameInput.style.borderColor = '#e74c3c';
      return;
    }
    playerNameInput.style.borderColor = '';
    playerName = name;
    currentPlayerName = name;
    localStorage.setItem('snakePlayerName', name);

    startBtn.disabled = true;
    startBtn.textContent = 'Submitting...';

    const result = await submitScore(name, pendingScore);
    pendingScore = null;

    let msg = `Score: ${score}`;
    if (result) {
      if (typeof result.score === 'number' && result.score > score) {
        msg += ` (Best: ${result.score})`;
      }
      if (result.rank) {
        msg += ` — Rank #${result.rank}`;
      }
    }

    overlayMessage.textContent = msg;
    playerNameInput.style.display = 'none';
    startBtn.disabled = false;
    startBtn.textContent = 'Play Again';

    await fetchLeaderboard();
  }

  function startGame() {
    overlay.classList.add('hidden');
    initGame();
    draw();
    running = true;
    gameLoop = setInterval(update, getCurrentTickInterval());
    startBonusCycle();
  }

  // --- Input ---

  document.addEventListener('keydown', (e) => {
    if (!running) {
      if (e.key === 'Enter') {
        startBtn.click();
      }
      return;
    }

    const key = e.key;
    let newDir = null;

    switch (key) {
      case 'ArrowUp': case 'w': case 'W':
        newDir = { x: 0, y: -1 }; break;
      case 'ArrowDown': case 's': case 'S':
        newDir = { x: 0, y: 1 }; break;
      case 'ArrowLeft': case 'a': case 'A':
        newDir = { x: -1, y: 0 }; break;
      case 'ArrowRight': case 'd': case 'D':
        newDir = { x: 1, y: 0 }; break;
      default: return;
    }

    e.preventDefault();

    // Prevent 180-degree reversal
    if (newDir.x === -direction.x && newDir.y === -direction.y) {
      return;
    }

    nextDirection = newDir;
  });

  // --- Events ---

  startBtn.addEventListener('click', () => {
    if (pendingScore !== null) {
      submitAndRestart();
    } else {
      startGame();
    }
  });

  // --- Init ---

  fetchLeaderboard();
  draw();
  initGame();
  draw();
})();
