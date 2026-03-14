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
  const upgradeMegaClickEl = document.getElementById('upgrade-mega-click');
  const upgradeMegaClickStatusEl = document.getElementById('upgrade-mega-click-status');
  const upgradeSuperAutoEl = document.getElementById('upgrade-super-auto');
  const upgradeSuperAutoStatusEl = document.getElementById('upgrade-super-auto-status');
  const upgradeUltraClickEl = document.getElementById('upgrade-ultra-click');
  const upgradeUltraClickStatusEl = document.getElementById('upgrade-ultra-click-status');
  const upgradeGodAutoEl = document.getElementById('upgrade-god-auto');
  const upgradeGodAutoStatusEl = document.getElementById('upgrade-god-auto-status');
  const upgradeCosmicClickEl = document.getElementById('upgrade-cosmic-click');
  const upgradeCosmicClickStatusEl = document.getElementById('upgrade-cosmic-click-status');
  const upgradeLegendClickEl = document.getElementById('upgrade-legend-click');
  const upgradeLegendClickStatusEl = document.getElementById('upgrade-legend-click-status');
  const upgradeMythicClickEl = document.getElementById('upgrade-mythic-click');
  const upgradeMythicClickStatusEl = document.getElementById('upgrade-mythic-click-status');
  const upgradeOmegaAutoEl = document.getElementById('upgrade-omega-auto');
  const upgradeOmegaAutoStatusEl = document.getElementById('upgrade-omega-auto-status');

  const BASE_CLICK_UPGRADE_COST = 50;
  const BASE_AUTO_UPGRADE_COST = 125;
  const MEGA_CLICK_UPGRADE_COST = 500;
  const SUPER_AUTO_UPGRADE_COST = 1000;
  const ULTRA_CLICK_UPGRADE_COST = 10000;
  const GOD_AUTO_UPGRADE_COST = 80000;
  const COSMIC_CLICK_UPGRADE_COST = 100000;
  const LEGEND_CLICK_UPGRADE_COST = 500000;
  const MYTHIC_CLICK_UPGRADE_COST = 2500000;
  const OMEGA_AUTO_UPGRADE_COST = 15000000;
  let score = 0;
  let clickPower = 1;
  let clicksPerSecond = 0;
  let clickUpgradeLevel = 0;
  let autoUpgradeLevel = 0;
  let megaClickUpgradeLevel = 0;
  let superAutoUpgradeLevel = 0;
  let ultraClickUpgradeLevel = 0;
  let godAutoUpgradeLevel = 0;
  let cosmicClickUpgradeLevel = 0;
  let legendClickUpgradeLevel = 0;
  let mythicClickUpgradeLevel = 0;
  let omegaAutoUpgradeLevel = 0;

  function getTierMultiplier(level) {
    return Math.floor(level / 10) + 1;
  }

  function getScaledGain(baseGain, level) {
    return baseGain * getTierMultiplier(level);
  }

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
      upgradeClickEl.disabled = score < BASE_CLICK_UPGRADE_COST;
      const gain = getScaledGain(1, clickUpgradeLevel);
      const tier = getTierMultiplier(clickUpgradeLevel);
      upgradeClickEl.textContent = `Buy Tap Boost (Cost: ${BASE_CLICK_UPGRADE_COST}) - +${gain} per click`;
      const remaining = Math.max(BASE_CLICK_UPGRADE_COST - score, 0);
      upgradeStatusEl.textContent = remaining > 0
        ? `Level ${clickUpgradeLevel} (Tier ${tier}): ${remaining} more clicks needed.`
        : `Level ${clickUpgradeLevel} (Tier ${tier}): ready to buy +${gain} per click.`;
    }

    if (upgradeAutoEl && upgradeAutoStatusEl) {
      upgradeAutoEl.disabled = score < BASE_AUTO_UPGRADE_COST;
      const gain = getScaledGain(1, autoUpgradeLevel);
      const tier = getTierMultiplier(autoUpgradeLevel);
      upgradeAutoEl.textContent = `Buy Auto Frog (Cost: ${BASE_AUTO_UPGRADE_COST}) - +${gain} click/sec`;
      const autoRemaining = Math.max(BASE_AUTO_UPGRADE_COST - score, 0);
      upgradeAutoStatusEl.textContent = autoRemaining > 0
        ? `Level ${autoUpgradeLevel} (Tier ${tier}): ${autoRemaining} more clicks needed.`
        : `Level ${autoUpgradeLevel} (Tier ${tier}): ready to buy +${gain} click/sec.`;
    }

    if (upgradeMegaClickEl && upgradeMegaClickStatusEl) {
      const gain = getScaledGain(5, megaClickUpgradeLevel);
      const tier = getTierMultiplier(megaClickUpgradeLevel);
      upgradeMegaClickEl.disabled = score < MEGA_CLICK_UPGRADE_COST;
      upgradeMegaClickEl.textContent = `Buy Mega Leap (Cost: ${MEGA_CLICK_UPGRADE_COST}) - +${gain} per click`;
      const megaRemaining = Math.max(MEGA_CLICK_UPGRADE_COST - score, 0);
      upgradeMegaClickStatusEl.textContent = megaRemaining > 0
        ? `Level ${megaClickUpgradeLevel} (Tier ${tier}): ${megaRemaining} more clicks needed.`
        : `Level ${megaClickUpgradeLevel} (Tier ${tier}): ready for +${gain} per click.`;
    }

    if (upgradeSuperAutoEl && upgradeSuperAutoStatusEl) {
      const gain = getScaledGain(5, superAutoUpgradeLevel);
      const tier = getTierMultiplier(superAutoUpgradeLevel);
      upgradeSuperAutoEl.disabled = score < SUPER_AUTO_UPGRADE_COST;
      upgradeSuperAutoEl.textContent = `Buy Frog Squad (Cost: ${SUPER_AUTO_UPGRADE_COST}) - +${gain} click/sec`;
      const superAutoRemaining = Math.max(SUPER_AUTO_UPGRADE_COST - score, 0);
      upgradeSuperAutoStatusEl.textContent = superAutoRemaining > 0
        ? `Level ${superAutoUpgradeLevel} (Tier ${tier}): ${superAutoRemaining} more clicks needed.`
        : `Level ${superAutoUpgradeLevel} (Tier ${tier}): ready for +${gain} click/sec.`;
    }

    if (upgradeUltraClickEl && upgradeUltraClickStatusEl) {
      const gain = getScaledGain(100, ultraClickUpgradeLevel);
      const tier = getTierMultiplier(ultraClickUpgradeLevel);
      upgradeUltraClickEl.disabled = score < ULTRA_CLICK_UPGRADE_COST;
      upgradeUltraClickEl.textContent = `Buy Frog Titan (Cost: ${ULTRA_CLICK_UPGRADE_COST}) - +${gain} per click`;
      const ultraRemaining = Math.max(ULTRA_CLICK_UPGRADE_COST - score, 0);
      upgradeUltraClickStatusEl.textContent = ultraRemaining > 0
        ? `Level ${ultraClickUpgradeLevel} (Tier ${tier}): ${ultraRemaining} more clicks needed.`
        : `Level ${ultraClickUpgradeLevel} (Tier ${tier}): ready for +${gain} per click.`;
    }

    if (upgradeGodAutoEl && upgradeGodAutoStatusEl) {
      const gain = getScaledGain(200, godAutoUpgradeLevel);
      const tier = getTierMultiplier(godAutoUpgradeLevel);
      upgradeGodAutoEl.disabled = score < GOD_AUTO_UPGRADE_COST;
      upgradeGodAutoEl.textContent = `Buy Pond Engine (Cost: ${GOD_AUTO_UPGRADE_COST}) - +${gain} click/sec`;
      const godAutoRemaining = Math.max(GOD_AUTO_UPGRADE_COST - score, 0);
      upgradeGodAutoStatusEl.textContent = godAutoRemaining > 0
        ? `Level ${godAutoUpgradeLevel} (Tier ${tier}): ${godAutoRemaining} more clicks needed.`
        : `Level ${godAutoUpgradeLevel} (Tier ${tier}): ready for +${gain} click/sec.`;
    }

    if (upgradeCosmicClickEl && upgradeCosmicClickStatusEl) {
      const gain = getScaledGain(1000, cosmicClickUpgradeLevel);
      const tier = getTierMultiplier(cosmicClickUpgradeLevel);
      upgradeCosmicClickEl.disabled = score < COSMIC_CLICK_UPGRADE_COST;
      upgradeCosmicClickEl.textContent = `Buy Cosmic Tongue (Cost: ${COSMIC_CLICK_UPGRADE_COST}) - +${gain} per click`;
      const cosmicRemaining = Math.max(COSMIC_CLICK_UPGRADE_COST - score, 0);
      upgradeCosmicClickStatusEl.textContent = cosmicRemaining > 0
        ? `Level ${cosmicClickUpgradeLevel} (Tier ${tier}): ${cosmicRemaining} more clicks needed.`
        : `Level ${cosmicClickUpgradeLevel} (Tier ${tier}): ready for +${gain} per click.`;
    }

    if (upgradeLegendClickEl && upgradeLegendClickStatusEl) {
      const gain = getScaledGain(5000, legendClickUpgradeLevel);
      const tier = getTierMultiplier(legendClickUpgradeLevel);
      upgradeLegendClickEl.disabled = score < LEGEND_CLICK_UPGRADE_COST;
      upgradeLegendClickEl.textContent = `Buy Legend Leap (Cost: ${LEGEND_CLICK_UPGRADE_COST}) - +${gain} per click`;
      const legendRemaining = Math.max(LEGEND_CLICK_UPGRADE_COST - score, 0);
      upgradeLegendClickStatusEl.textContent = legendRemaining > 0
        ? `Level ${legendClickUpgradeLevel} (Tier ${tier}): ${legendRemaining} more clicks needed.`
        : `Level ${legendClickUpgradeLevel} (Tier ${tier}): ready for +${gain} per click.`;
    }

    if (upgradeMythicClickEl && upgradeMythicClickStatusEl) {
      const gain = getScaledGain(10000, mythicClickUpgradeLevel);
      const tier = getTierMultiplier(mythicClickUpgradeLevel);
      upgradeMythicClickEl.disabled = score < MYTHIC_CLICK_UPGRADE_COST;
      upgradeMythicClickEl.textContent = `Buy Mythic Jump (Cost: ${MYTHIC_CLICK_UPGRADE_COST}) - +${gain} per click`;
      const mythicRemaining = Math.max(MYTHIC_CLICK_UPGRADE_COST - score, 0);
      upgradeMythicClickStatusEl.textContent = mythicRemaining > 0
        ? `Level ${mythicClickUpgradeLevel} (Tier ${tier}): ${mythicRemaining} more clicks needed.`
        : `Level ${mythicClickUpgradeLevel} (Tier ${tier}): ready for +${gain} per click.`;
    }

    if (upgradeOmegaAutoEl && upgradeOmegaAutoStatusEl) {
      const gain = getScaledGain(100000, omegaAutoUpgradeLevel);
      const tier = getTierMultiplier(omegaAutoUpgradeLevel);
      upgradeOmegaAutoEl.disabled = score < OMEGA_AUTO_UPGRADE_COST;
      upgradeOmegaAutoEl.textContent = `Buy Omega Pond (Cost: ${OMEGA_AUTO_UPGRADE_COST}) - +${gain} click/sec`;
      const omegaRemaining = Math.max(OMEGA_AUTO_UPGRADE_COST - score, 0);
      upgradeOmegaAutoStatusEl.textContent = omegaRemaining > 0
        ? `Level ${omegaAutoUpgradeLevel} (Tier ${tier}): ${omegaRemaining} more clicks needed.`
        : `Level ${omegaAutoUpgradeLevel} (Tier ${tier}): ready for +${gain} click/sec.`;
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
    if (score < BASE_CLICK_UPGRADE_COST) return;

    const gain = getScaledGain(1, clickUpgradeLevel);
    score -= BASE_CLICK_UPGRADE_COST;
    clickPower += gain;
    clickUpgradeLevel += 1;
    render();
  }

  function buyAutoUpgrade() {
    if (score < BASE_AUTO_UPGRADE_COST) return;

    const gain = getScaledGain(1, autoUpgradeLevel);
    score -= BASE_AUTO_UPGRADE_COST;
    clicksPerSecond += gain;
    autoUpgradeLevel += 1;
    render();
  }

  function buyMegaClickUpgrade() {
    if (score < MEGA_CLICK_UPGRADE_COST) return;

    const gain = getScaledGain(5, megaClickUpgradeLevel);
    score -= MEGA_CLICK_UPGRADE_COST;
    clickPower += gain;
    megaClickUpgradeLevel += 1;
    render();
  }

  function buySuperAutoUpgrade() {
    if (score < SUPER_AUTO_UPGRADE_COST) return;

    const gain = getScaledGain(5, superAutoUpgradeLevel);
    score -= SUPER_AUTO_UPGRADE_COST;
    clicksPerSecond += gain;
    superAutoUpgradeLevel += 1;
    render();
  }

  function buyUltraClickUpgrade() {
    if (score < ULTRA_CLICK_UPGRADE_COST) return;

    const gain = getScaledGain(100, ultraClickUpgradeLevel);
    score -= ULTRA_CLICK_UPGRADE_COST;
    clickPower += gain;
    ultraClickUpgradeLevel += 1;
    render();
  }

  function buyGodAutoUpgrade() {
    if (score < GOD_AUTO_UPGRADE_COST) return;

    const gain = getScaledGain(200, godAutoUpgradeLevel);
    score -= GOD_AUTO_UPGRADE_COST;
    clicksPerSecond += gain;
    godAutoUpgradeLevel += 1;
    render();
  }

  function buyCosmicClickUpgrade() {
    if (score < COSMIC_CLICK_UPGRADE_COST) return;

    const gain = getScaledGain(1000, cosmicClickUpgradeLevel);
    score -= COSMIC_CLICK_UPGRADE_COST;
    clickPower += gain;
    cosmicClickUpgradeLevel += 1;
    render();
  }

  function buyLegendClickUpgrade() {
    if (score < LEGEND_CLICK_UPGRADE_COST) return;

    const gain = getScaledGain(5000, legendClickUpgradeLevel);
    score -= LEGEND_CLICK_UPGRADE_COST;
    clickPower += gain;
    legendClickUpgradeLevel += 1;
    render();
  }

  function buyMythicClickUpgrade() {
    if (score < MYTHIC_CLICK_UPGRADE_COST) return;

    const gain = getScaledGain(10000, mythicClickUpgradeLevel);
    score -= MYTHIC_CLICK_UPGRADE_COST;
    clickPower += gain;
    mythicClickUpgradeLevel += 1;
    render();
  }

  function buyOmegaAutoUpgrade() {
    if (score < OMEGA_AUTO_UPGRADE_COST) return;

    const gain = getScaledGain(100000, omegaAutoUpgradeLevel);
    score -= OMEGA_AUTO_UPGRADE_COST;
    clicksPerSecond += gain;
    omegaAutoUpgradeLevel += 1;
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

  if (upgradeMegaClickEl) {
    upgradeMegaClickEl.addEventListener('click', buyMegaClickUpgrade);
  }

  if (upgradeSuperAutoEl) {
    upgradeSuperAutoEl.addEventListener('click', buySuperAutoUpgrade);
  }

  if (upgradeUltraClickEl) {
    upgradeUltraClickEl.addEventListener('click', buyUltraClickUpgrade);
  }

  if (upgradeGodAutoEl) {
    upgradeGodAutoEl.addEventListener('click', buyGodAutoUpgrade);
  }

  if (upgradeCosmicClickEl) {
    upgradeCosmicClickEl.addEventListener('click', buyCosmicClickUpgrade);
  }

  if (upgradeLegendClickEl) {
    upgradeLegendClickEl.addEventListener('click', buyLegendClickUpgrade);
  }

  if (upgradeMythicClickEl) {
    upgradeMythicClickEl.addEventListener('click', buyMythicClickUpgrade);
  }

  if (upgradeOmegaAutoEl) {
    upgradeOmegaAutoEl.addEventListener('click', buyOmegaAutoUpgrade);
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
