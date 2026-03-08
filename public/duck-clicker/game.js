(() => {
  const scoreEl = document.getElementById('score');
  const powerEl = document.getElementById('power');
  const cpsEl = document.getElementById('cps');
  const duckButton = document.getElementById('duck-button');
  const duckSprite = document.getElementById('duck-sprite');
  const upgradeClickEl = document.getElementById('upgrade-click');
  const upgradeStatusEl = document.getElementById('upgrade-status');
  const upgradeAutoEl = document.getElementById('upgrade-auto');
  const upgradeAutoStatusEl = document.getElementById('upgrade-auto-status');

  const BASE_CLICK_UPGRADE_COST = 50;
  const BASE_AUTO_UPGRADE_COST = 75;
  const CLICK_UPGRADE_COST_SCALE = 1.65;
  const AUTO_UPGRADE_COST_SCALE = 1.7;
  let score = 0;
  let clickPower = 1;
  let clicksPerSecond = 0;
  let clickUpgradeLevel = 0;
  let autoUpgradeLevel = 0;
  let clickUpgradeCost = BASE_CLICK_UPGRADE_COST;
  let autoUpgradeCost = BASE_AUTO_UPGRADE_COST;

  const duckPixels = [
    '............................',
    '............................',
    '............................',
    '.........oo......oo.........',
    '........oyyo....oyyo........',
    '.......oyyyoooooyyyyo.......',
    '......oyyyyyyyyyyyyyyo......',
    '.....oyyywwyyyyyywwyyyo.....',
    '....oyyyweeyyyyyyeewyyyo....',
    '....oyyyyyyyyyyyyyyyyyyo....',
    '...oyyyyyyyyyyyyyyyyyyyyo...',
    '...oyyyyybooooooobyyyyyyo...',
    '...oyyyyyybrrrrbbyyyyyyyo...',
    '...oyyyyyyyyyyyyyyyyyyyyo...',
    '...oyyyyyyyyyyyyyyyyyyyyo...',
    '....oyyyyyyyyyyyyyyyyyyo....',
    '....oyyyyggyyyyyyggyyyyo....',
    '.....oyyyggggyyyyggggyyo....',
    '......oyyyyyyyyyyyyyyyo.....',
    '......oyyyooooooooyyyyo.....',
    '.......oyyo......oyyyo......',
    '.......oyyo......oyyyo......',
    '........oo........oo........',
    '.........o........o.........',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................'
  ];

  function buildDuckSprite() {
    if (!duckSprite) return;
    const cols = duckPixels[0].length;
    duckSprite.style.setProperty('--cols', String(cols));

    const fragment = document.createDocumentFragment();
    for (const row of duckPixels) {
      for (const c of row) {
        const pixel = document.createElement('span');
        pixel.className = 'duck-cell';
        if (c !== '.') {
          pixel.classList.add(`duck-cell--${c}`);
        }
        fragment.appendChild(pixel);
      }
    }

    duckSprite.replaceChildren(fragment);
  }

  function updateUpgradeUi() {
    if (upgradeClickEl && upgradeStatusEl) {
      upgradeClickEl.disabled = score < clickUpgradeCost;
      upgradeClickEl.textContent = `Buy Tap Boost (Cost: ${clickUpgradeCost}) - +1 per click`;
      const remaining = Math.max(clickUpgradeCost - score, 0);
      upgradeStatusEl.textContent = remaining > 0
        ? `Level ${clickUpgradeLevel}: ${remaining} more clicks needed.`
        : `Level ${clickUpgradeLevel}: ready to buy +1 per click.`;
    }

    if (upgradeAutoEl && upgradeAutoStatusEl) {
      upgradeAutoEl.disabled = score < autoUpgradeCost;
      upgradeAutoEl.textContent = `Buy Auto Frog (Cost: ${autoUpgradeCost}) - +1 click/sec`;
      const autoRemaining = Math.max(autoUpgradeCost - score, 0);
      upgradeAutoStatusEl.textContent = autoRemaining > 0
        ? `Level ${autoUpgradeLevel}: ${autoRemaining} more clicks needed.`
        : `Level ${autoUpgradeLevel}: ready to buy +1 click/sec.`;
    }
  }

  function render() {
    scoreEl.textContent = String(score);
    if (powerEl) {
      powerEl.textContent = String(clickPower);
    }
    if (cpsEl) {
      cpsEl.textContent = String(clicksPerSecond);
    }
    updateUpgradeUi();
  }

  function makeFloatingPlus(clientX, clientY) {
    const rect = duckButton.getBoundingClientRect();
    const plus = document.createElement('span');
    plus.className = 'floating-plus';
    plus.textContent = `+${clickPower}`;

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    plus.style.left = `${x}px`;
    plus.style.top = `${y}px`;

    duckButton.appendChild(plus);
    plus.addEventListener('animationend', () => plus.remove(), { once: true });
  }

  function clickDuck(clientX, clientY) {
    const rect = duckButton.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    duckButton.style.setProperty('--ripple-x', `${x}px`);
    duckButton.style.setProperty('--ripple-y', `${y}px`);

    score += clickPower;

    duckButton.classList.remove('pop');
    void duckButton.offsetWidth;
    duckButton.classList.add('pop');

    makeFloatingPlus(clientX, clientY);
    render();
  }

  function buyClickUpgrade() {
    if (score < clickUpgradeCost) return;

    score -= clickUpgradeCost;
    clickPower += 1;
    clickUpgradeLevel += 1;
    clickUpgradeCost = Math.ceil(BASE_CLICK_UPGRADE_COST * (CLICK_UPGRADE_COST_SCALE ** clickUpgradeLevel));
    render();
  }

  function buyAutoUpgrade() {
    if (score < autoUpgradeCost) return;

    score -= autoUpgradeCost;
    clicksPerSecond += 1;
    autoUpgradeLevel += 1;
    autoUpgradeCost = Math.ceil(BASE_AUTO_UPGRADE_COST * (AUTO_UPGRADE_COST_SCALE ** autoUpgradeLevel));
    render();
  }

  duckButton.addEventListener('click', (event) => {
    clickDuck(event.clientX, event.clientY);
  });

  if (upgradeClickEl) {
    upgradeClickEl.addEventListener('click', buyClickUpgrade);
  }

  if (upgradeAutoEl) {
    upgradeAutoEl.addEventListener('click', buyAutoUpgrade);
  }

  // Keyboard support for quick tapping.
  document.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      const rect = duckButton.getBoundingClientRect();
      clickDuck(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  });

  setInterval(() => {
    if (clicksPerSecond <= 0) return;
    score += clicksPerSecond;
    render();
  }, 1000);

  render();
  buildDuckSprite();
})();
