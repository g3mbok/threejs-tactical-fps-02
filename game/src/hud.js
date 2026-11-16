import { ARSENAL } from './weapon.js';

const COSTS = Object.fromEntries(ARSENAL.map((item) => [item.id, item.price]));
Object.assign(COSTS, { armor: 650, frag: 450, kit: 400, close: 0 });

const byId = (id) => document.getElementById(id);

function clockText(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

export function createHud() {
  const intro = byId('intro');
  const play = byId('play');
  const buy = byId('buy-menu');
  const buyCash = byId('buy-cash');
  const actionWrap = byId('action-wrap');
  const actionFill = byId('action-fill');
  const toast = byId('toast');
  const feed = byId('feed');
  const radar = byId('radar');
  const context = radar.getContext('2d');
  const scoreboard = byId('scoreboard');
  let toastTimer = 0;
  let actionText = '';
  let lastAmmo = '';
  let onBuy = () => {};
  let onCloseBuy = () => {};

  for (const button of buy.querySelectorAll('[data-buy]')) {
    button.addEventListener('click', () => {
      const item = button.dataset.buy;
      if (item === 'close') onCloseBuy();
      else onBuy(item);
    });
  }
  byId('buy-close').addEventListener('click', () => onCloseBuy());

  function setAmmo(mag, reserve) {
    const value = `${mag}:${reserve}`;
    if (value === lastAmmo) return;
    lastAmmo = value;
    byId('ammo-mag').textContent = String(mag);
    byId('ammo-reserve').textContent = String(reserve);
    byId('ammo-mag').style.color = mag === 0 ? 'var(--red)' : 'var(--ink)';
  }

  function drawRadar(player, agents, site) {
    const width = radar.width;
    const height = radar.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(10, 29, 34, .86)';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(140, 185, 170, .16)';
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 45) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 42) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.strokeStyle = 'rgba(169, 197, 180, .5)';
    context.lineWidth = 3;
    context.strokeRect(12, 12, width - 24, height - 24);
    context.strokeStyle = 'rgba(188, 205, 182, .28)';
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(width / 2, height - 15);
    context.lineTo(width / 2, height * 0.62);
    context.lineTo(width * 0.28, height * 0.4);
    context.moveTo(width / 2, height * 0.62);
    context.lineTo(width * 0.72, height * 0.4);
    context.lineTo(width / 2, 15);
    context.stroke();

    const point = (x, z) => ({
      x: 16 + (x + 20) / 40 * (width - 32),
      y: 12 + (z + 18) / 36 * (height - 24),
    });
    for (const [id, x] of [['A', -12], ['B', 12]]) {
      const p = point(x, -4);
      context.beginPath();
      context.arc(p.x, p.y, 13, 0, Math.PI * 2);
      context.fillStyle = id === 'A' ? 'rgba(240,169,88,.19)' : 'rgba(102,214,207,.15)';
      context.fill();
      context.strokeStyle = id === 'A' ? 'rgba(240,169,88,.75)' : 'rgba(102,214,207,.72)';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#eaf0e7';
      context.font = '700 14px ui-monospace, monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(id, p.x, p.y);
    }
    for (const agent of agents) {
      if (!agent.alive) continue;
      const p = point(agent.position.x, agent.position.z);
      context.beginPath();
      context.arc(p.x, p.y, 5, 0, Math.PI * 2);
      context.fillStyle = agent.side === 'attack' ? '#f0a958' : '#66d6cf';
      context.fill();
    }
    const p = point(player.position.x, player.position.z);
    context.save();
    context.translate(p.x, p.y);
    context.rotate(-player.yaw);
    context.beginPath();
    context.moveTo(0, -9);
    context.lineTo(6, 6);
    context.lineTo(0, 3);
    context.lineTo(-6, 6);
    context.closePath();
    context.fillStyle = '#eff4e9';
    context.fill();
    context.restore();
    if (site) {
      const p = point(site.position.x, site.position.z);
      context.beginPath();
      context.arc(p.x, p.y, 18, 0, Math.PI * 2);
      context.strokeStyle = '#f0a958';
      context.lineWidth = 2;
      context.stroke();
    }
  }

  return {
    onPlay(handler) { play.addEventListener('click', handler); },
    onBuy(handler) { onBuy = handler; },
    onCloseBuy(handler) { onCloseBuy = handler; },
    hideIntro() { intro.hidden = true; },
    showIntro() { intro.hidden = false; },
    showBuy(cash) {
      buy.hidden = false;
      this.setBuyCash(cash);
    },
    hideBuy() { buy.hidden = true; },
    setBuyCash(cash) {
      buyCash.textContent = `$${cash.toLocaleString('en-US')}`;
      for (const button of buy.querySelectorAll('[data-buy]')) {
        const price = COSTS[button.dataset.buy] ?? Infinity;
        button.disabled = button.dataset.buy !== 'close' && price > cash;
      }
    },
    setRound({ round, rounds, attackScore, defendScore, seconds, side, phase, attackAlive, defendAlive }) {
      byId('round-number').textContent = `${String(round).padStart(2, '0')} / ${String(rounds).padStart(2, '0')}`;
      byId('attack-score').textContent = String(attackScore);
      byId('defend-score').textContent = String(defendScore);
      const clock = byId('round-clock');
      clock.textContent = clockText(seconds);
      clock.classList.toggle('danger', seconds < 16);
      const sideLabel = byId('side-label');
      sideLabel.textContent = `${side === 'attack' ? 'ASHLINE // ATTACK' : 'TIDEGUARD // HOLD'}`;
      sideLabel.classList.toggle('attack', side === 'attack');
      byId('objective-chip').textContent = phase === 'planted' ? `DEVICE LIVE / ${clockText(seconds)}` : phase === 'prep' ? 'BUY WINDOW' : phase === 'result' ? 'ROUND COMPLETE' : 'DEVICE ACTIVE';
      byId('attack-alive').textContent = String(attackAlive);
      byId('defend-alive').textContent = String(defendAlive);
    },
    setPlayer({ health, armor, credits, kills, weapon, mag, reserve }) {
      byId('health-value').textContent = String(Math.max(0, Math.ceil(health)));
      byId('armor-value').textContent = String(Math.max(0, Math.ceil(armor)));
      byId('credits-value').textContent = `$${credits.toLocaleString('en-US')}`;
      byId('weapon-name').textContent = weapon.name;
      byId('weapon-role').textContent = weapon.role;
      setAmmo(mag, reserve);
      byId('sb-kills').textContent = String(kills);
      byId('sb-health').textContent = String(Math.max(0, Math.ceil(health)));
    },
    updateBuyAvailability(cash) {
      this.setBuyCash(cash);
    },
    drawRadar,
    setAction(label, progress = 0) {
      if (!label) {
        actionText = '';
        actionWrap.hidden = true;
        return;
      }
      actionText = label;
      byId('action-label').textContent = actionText;
      actionFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
      actionWrap.hidden = false;
    },
    hit(killed) {
      const marker = byId('hitmarker');
      marker.classList.add('on');
      marker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.3)' : '';
      setTimeout(() => {
        marker.classList.remove('on');
        marker.style.transform = '';
      }, 110);
    },
    message(text, color = 'var(--amber)', duration = 1800) {
      toast.textContent = text;
      toast.style.color = color;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
    },
    addFeed(killer, victim, team, down = false) {
      const row = document.createElement('div');
      row.className = `feed-row${down ? ' down' : ''}`;
      row.textContent = `${killer}  /  ${victim}`;
      row.style.borderRightColor = team === 'attack' ? 'var(--amber)' : 'var(--cyan)';
      feed.prepend(row);
      while (feed.children.length > 4) feed.lastElementChild.remove();
      setTimeout(() => row.remove(), 4800);
    },
    phaseAlert(title, subtitle, duration = 1700) {
      const panel = byId('phase-alert');
      byId('phase-title').textContent = title;
      byId('phase-subtitle').textContent = subtitle;
      panel.classList.add('show');
      setTimeout(() => panel.classList.remove('show'), duration);
    },
    toggleScoreboard(visible, attackAlive, defendAlive) {
      scoreboard.hidden = !visible;
      byId('sb-attack').textContent = String(attackAlive);
      byId('sb-defend').textContent = String(defendAlive);
    },
    setCrosshair(aiming, spread) {
      const crosshair = byId('crosshair');
      crosshair.classList.toggle('aim', aiming);
      crosshair.style.scale = String(1 + Math.min(1, spread * 18));
    },
  };
}
