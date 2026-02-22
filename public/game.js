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
  const BONUS_DURATION = 5000;  // 5 seconds

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
  let bonus = null; // { x, y }
  let direction = { x: 1, y: 0 };
  let nextDirection = { x: 1, y: 0 };
  let score = 0;
  let applesEaten = 0;
  let speed = START_SPEED;
  let gameLoop = null;
  let bonusSpawnTimer = null;
  let bonusExpireTimer = null;
  let running = false;
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
    if (bonus) set.add(`${bonus.x},${bonus.y}`);
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
    speed = START_SPEED;
    bonus = null;
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
    bonus = free[Math.floor(Math.random() * free.length)];
    // Bonus disappears after BONUS_DURATION
    bonusExpireTimer = setTimeout(() => {
      bonus = null;
    }, BONUS_DURATION);
  }

  function clearBonusTimers() {
    if (bonusSpawnTimer) { clearInterval(bonusSpawnTimer); bonusSpawnTimer = null; }
    if (bonusExpireTimer) { clearTimeout(bonusExpireTimer); bonusExpireTimer = null; }
  }

  function startBonusCycle() {
    bonusSpawnTimer = setInterval(() => {
      if (!bonus && running) {
        spawnBonus();
      }
    }, BONUS_INTERVAL);
  }

  function update() {
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

    let ate = false;

    // Apple eaten
    if (apple && head.x === apple.x && head.y === apple.y) {
      score += APPLE_SCORE;
      applesEaten++;
      scoreDisplay.textContent = score;
      speed = Math.max(MIN_SPEED, START_SPEED - applesEaten * SPEED_DECREASE);
      spawnApple();
      ate = true;
      // Restart loop with new speed
      clearInterval(gameLoop);
      gameLoop = setInterval(update, speed);
    }

    // Bonus eaten
    if (bonus && head.x === bonus.x && head.y === bonus.y) {
      score += BONUS_SCORE;
      scoreDisplay.textContent = score;
      bonus = null;
      if (bonusExpireTimer) { clearTimeout(bonusExpireTimer); bonusExpireTimer = null; }
      ate = true;
    }

    if (!ate) {
      snake.pop();
    }

    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

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
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      const cx = apple.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = apple.y * CELL_SIZE + CELL_SIZE / 2;
      ctx.arc(cx, cy, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bonus (golden star-like diamond)
    if (bonus) {
      const bx = bonus.x * CELL_SIZE + CELL_SIZE / 2;
      const by = bonus.y * CELL_SIZE + CELL_SIZE / 2;
      const r = CELL_SIZE / 2 - 2;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(bx, by - r);
      ctx.lineTo(bx + r * 0.6, by - r * 0.3);
      ctx.lineTo(bx + r, by);
      ctx.lineTo(bx + r * 0.6, by + r * 0.3);
      ctx.lineTo(bx, by + r);
      ctx.lineTo(bx - r * 0.6, by + r * 0.3);
      ctx.lineTo(bx - r, by);
      ctx.lineTo(bx - r * 0.6, by - r * 0.3);
      ctx.closePath();
      ctx.fill();
      // Glow effect
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw snake (gradient: bright head → darker tail)
    snake.forEach((seg, i) => {
      const isHead = i === 0;
      let fillColor;
      if (isHead) {
        fillColor = '#5ff5c8';
      } else {
        const t = snake.length > 1 ? (i - 1) / (snake.length - 1) : 0;
        const r = Math.round(78 - t * 50);
        const g = Math.round(204 - t * 140);
        const b = Math.round(163 - t * 110);
        fillColor = `rgb(${r},${g},${b})`;
      }
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

  async function gameOver() {
    running = false;
    clearInterval(gameLoop);
    clearBonusTimers();
    bonus = null;

    const result = await submitScore(playerName, score);

    let msg = `Score: ${score}`;
    if (result && result.rank) {
      msg += ` — Rank #${result.rank}`;
    }

    overlayTitle.textContent = 'Game Over';
    overlayMessage.textContent = msg;
    playerNameInput.style.display = 'none';
    startBtn.textContent = 'Play Again';
    overlay.classList.remove('hidden');

    await fetchLeaderboard();
  }

  function startGame() {
    const name = playerNameInput.value.trim();
    if (!name || !/^[a-zA-Z0-9_]+$/.test(name) || name.length > 20) {
      playerNameInput.style.borderColor = '#e74c3c';
      return;
    }
    playerNameInput.style.borderColor = '';
    playerName = name;
    currentPlayerName = name;
    localStorage.setItem('snakePlayerName', name);

    overlay.classList.add('hidden');
    initGame();
    draw();
    running = true;
    gameLoop = setInterval(update, speed);
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

  startBtn.addEventListener('click', startGame);

  // --- Init ---

  fetchLeaderboard();
  draw();
  initGame();
  draw();
})();
