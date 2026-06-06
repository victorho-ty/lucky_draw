'use strict';

// ─── Screen dimensions (fixed at load time) ────────────────────────────────
const W = window.innerWidth;
const H = window.innerHeight;
const BALL_R = Math.min(25, Math.round(W / 60));

// ─── Game state ────────────────────────────────────────────────────────────
let engine, render, runner;
let balls = [];
let winners = [];
let gameState = 'idle'; // 'idle' | 'running' | 'finished'
let stateData = { participants: [], config: { winners_count: 3, speed: 'medium' } };

// Multi-stage state
let activeParticipants = [];
let stageNumber        = 1;
let isFinale           = false;
let stageCaptures      = [];
let stageTarget        = 0;

// Geometry constants (derived from screen size and ball radius)
const FUNNEL_TOP_Y   = H * 0.57;
const FUNNEL_BOT_Y   = H * 0.83;
const GAP_WIDTH      = BALL_R * 3.5;
const BUCKET_BOT_Y   = H * 0.95;

// ─── Physics setup ─────────────────────────────────────────────────────────
function setupWorld() {
  const { Engine, Render, Runner, World, Events } = Matter;

  engine = Engine.create();
  applyGravity(stateData.config.speed);

  render = Render.create({
    element: document.getElementById('canvas-container'),
    engine,
    options: {
      width:      W,
      height:     H,
      wireframes: false,
      background: '#0d0d2b',
    },
  });

  runner = Runner.create();

  const staticBodies = [
    ...buildPegs(),
    ...buildFunnelPegs(),
    ...buildFunnelWalls(),
    ...buildSideWalls(),
    buildFloor(),
    buildWinnerSensor(),
  ];
  World.add(engine.world, staticBodies);

  Events.on(engine, 'collisionStart', onCollision);
  Events.on(render, 'afterRender',    drawOverlay);

  Render.run(render);
  Runner.run(runner, engine);
}

function applyGravity(speed) {
  const gravities = { slow: 0.3, medium: 0.7, fast: 1.5 };
  engine.gravity.y = gravities[speed] ?? 0.7;
}

// ─── Static world bodies ───────────────────────────────────────────────────
function buildPegs() {
  const pegR      = Math.max(6, Math.round(W / 220));
  const spacingX  = Math.max(55, Math.round(W / 22));
  const numRows   = 7;
  const topY      = BALL_R * 7;
  const bottomY   = FUNNEL_TOP_Y - BALL_R * 2;
  const rowSpacing = (bottomY - topY) / (numRows - 1);
  const pegs = [];

  for (let row = 0; row < numRows; row++) {
    const y      = topY + row * rowSpacing;
    const offset = row % 2 === 0 ? 0 : spacingX / 2;
    let x = offset + pegR;
    while (x <= W - pegR) {
      pegs.push(Matter.Bodies.circle(x, y, pegR, {
        isStatic:   true,
        restitution: 0.65,
        friction:   0.03,
        render: { fillStyle: '#5a4fcf', strokeStyle: '#7b6ee0', lineWidth: 1 },
        label: 'peg',
      }));
      x += spacingX;
    }
  }
  return pegs;
}

function buildFunnelWalls() {
  // Walls span from screen edges down to the narrow gap at centre bottom.
  const topLeft  = { x: -10,      y: FUNNEL_TOP_Y };
  const topRight = { x: W + 10,   y: FUNNEL_TOP_Y };
  const botLeft  = { x: W / 2 - GAP_WIDTH / 2, y: FUNNEL_BOT_Y };
  const botRight = { x: W / 2 + GAP_WIDTH / 2, y: FUNNEL_BOT_Y };
  return [
    makeWallSegment(topLeft,  botLeft),
    makeWallSegment(topRight, botRight),
  ];
}

// Returns the left and right x positions of the funnel walls at a given y.
function getFunnelBoundsAtY(y) {
  const t      = (y - FUNNEL_TOP_Y) / (FUNNEL_BOT_Y - FUNNEL_TOP_Y);
  const leftX  = -10       + t * (W / 2 - GAP_WIDTH / 2 + 10);
  const rightX = (W + 10)  + t * (W / 2 + GAP_WIDTH / 2 - (W + 10));
  return { leftX, rightX };
}

function buildFunnelPegs() {
  const pegR     = Math.max(5, Math.round(W / 280));
  const pegs     = [];
  const rows     = [0.15, 0.38];
  // Pegs only occupy the central 50% of the funnel width at each row.
  // The outer 25% on each side stays clear so balls sliding down the
  // funnel walls are never intercepted.
  const BAND     = 0.50;
  const minClear = BALL_R * 3; // safety-net: skip anything still too close to wall

  rows.forEach((frac, rowIdx) => {
    const y = FUNNEL_TOP_Y + frac * (FUNNEL_BOT_Y - FUNNEL_TOP_Y);
    const { leftX, rightX } = getFunnelBoundsAtY(y);
    const center  = (leftX + rightX) / 2;
    const bandW   = (rightX - leftX) * BAND;
    const xStart  = center - bandW / 2;
    const xEnd    = center + bandW / 2;
    if (bandW < pegR * 4) return;
    const spacing = Math.max(pegR * 4, Math.round(bandW / 5));
    const offset  = rowIdx % 2 === 0 ? 0 : spacing / 2;
    let x = xStart + offset;
    while (x <= xEnd) {
      if (x - leftX >= minClear && rightX - x >= minClear) {
        pegs.push(Matter.Bodies.circle(x, y, pegR, {
          isStatic:    true,
          restitution: 0.65,
          friction:    0.03,
          render: { fillStyle: '#a855f7', strokeStyle: '#c084fc', lineWidth: 1 },
          label: 'peg',
        }));
      }
      x += spacing;
    }
  });
  return pegs;
}

function makeWallSegment(p1, p2) {
  const cx    = (p1.x + p2.x) / 2;
  const cy    = (p1.y + p2.y) / 2;
  const len   = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  return Matter.Bodies.rectangle(cx, cy, len, 20, {
    isStatic: true,
    angle,
    friction:    0.05,
    restitution: 0.35,
    render: { fillStyle: '#7264d6', strokeStyle: '#9b8eff', lineWidth: 1 },
    label: 'wall',
  });
}

function buildSideWalls() {
  const wallH = H * 4;
  const wallW = 50;
  const opts  = { isStatic: true, render: { fillStyle: '#0d0d2b' }, label: 'wall' };
  return [
    Matter.Bodies.rectangle(-wallW / 2, H / 2, wallW, wallH, opts),
    Matter.Bodies.rectangle(W + wallW / 2, H / 2, wallW, wallH, opts),
  ];
}

function buildFloor() {
  return Matter.Bodies.rectangle(W / 2, H + 35, W * 3, 70, {
    isStatic: true,
    render: { fillStyle: '#0d0d2b' },
    label: 'floor',
  });
}

function buildWinnerSensor() {
  return Matter.Bodies.rectangle(W / 2, FUNNEL_BOT_Y + BALL_R, GAP_WIDTH + BALL_R * 2, BALL_R * 1.2, {
    isStatic: true,
    isSensor: true,
    render: { fillStyle: 'rgba(255,215,0,0.08)', strokeStyle: 'rgba(255,215,0,0.3)', lineWidth: 1 },
    label: 'winner-sensor',
  });
}

// ─── Ball spawning ──────────────────────────────────────────────────────────
const BALL_COLORS = [
  '#ff6b9d', '#c44dff', '#4dc8ff', '#4dffaa', '#ffb84d',
  '#ff6b6b', '#ffd700', '#6bffc8', '#ff9f50', '#50b8ff',
  '#ff80bf', '#b280ff', '#80dfff', '#80ffc0', '#ffc880',
];

function spawnBalls() {
  const jitterMap = { slow: 0.4, medium: 0.8, fast: 1.6 };
  const jitter    = jitterMap[stateData.config.speed] ?? 0.8;
  const padding   = BALL_R * 2.5;

  balls = activeParticipants.map((p, i) => {
    const x    = padding + Math.random() * (W - padding * 2);
    const ball = Matter.Bodies.circle(x, -BALL_R * 2 - i * 3, BALL_R, {
      restitution: 0.5,
      friction:    0.05,
      frictionAir: 0.001,
      render: { fillStyle: BALL_COLORS[i % BALL_COLORS.length] },
      label: 'ball',
    });
    ball.participant = p;
    Matter.Body.setVelocity(ball, { x: (Math.random() - 0.5) * jitter, y: 0 });
    return ball;
  });

  Matter.World.add(engine.world, balls);
}

// ─── Collision / winner detection ──────────────────────────────────────────
function onCollision(event) {
  if (gameState !== 'running') return;

  for (const pair of event.pairs) {
    const { bodyA, bodyB } = pair;
    let ball = null;
    if (bodyA.label === 'winner-sensor' && bodyB.label === 'ball') ball = bodyB;
    if (bodyB.label === 'winner-sensor' && bodyA.label === 'ball') ball = bodyA;
    if (!ball || !ball.participant) continue;
    if (stageCaptures.some(w => w.id === ball.participant.id)) continue;

    stageCaptures.push(ball.participant);
    markWinnerBall(ball);

    if (stageCaptures.length >= stageTarget) {
      endStage();
      return;
    }
  }
}

function markWinnerBall(ball) {
  ball.render.fillStyle   = '#ffd700';
  ball.render.strokeStyle = '#ffffff';
  ball.render.lineWidth   = 3;
}

// ─── Game control ──────────────────────────────────────────────────────────
function initGame() {
  activeParticipants = [...stateData.participants];
  stageNumber        = 1;
  isFinale           = false;
  stageCaptures      = [];
  stageTarget        = 0;
  updateStartBtn();
}

function beginStage() {
  if (activeParticipants.length === 0) {
    alert('Add participants on the admin page first.');
    return;
  }
  const winCount = stateData.config.winners_count;
  if (activeParticipants.length < winCount) {
    alert(`Need at least ${winCount} participants.`);
    return;
  }

  isFinale      = activeParticipants.length <= winCount * 2;
  stageTarget   = isFinale ? winCount : Math.ceil(activeParticipants.length / 2);
  stageCaptures = [];
  winners       = [];
  gameState     = 'running';

  document.getElementById('start-btn').style.display     = 'none';
  document.getElementById('winner-banner').style.display = 'none';
  document.getElementById('banner-content').classList.remove('banner-filter');

  applyGravity(stateData.config.speed);
  spawnBalls();
  updateHud();
}

function endStage() {
  gameState = 'finished';
  setTimeout(() => {
    if (isFinale) {
      winners = [...stageCaptures];
      showWinnerBanner();
    } else {
      showFilterBanner();
    }
  }, 900);
}

function advanceToNextStage() {
  balls.forEach(b => Matter.World.remove(engine.world, b));
  balls              = [];
  activeParticipants = [...stageCaptures];
  stageNumber       += 1;
  gameState          = 'idle';

  document.getElementById('winner-banner').style.display = 'none';
  document.getElementById('banner-content').classList.remove('banner-filter');
  document.getElementById('start-btn').style.display = '';

  updateStartBtn();
  updateHud();
}

function resetGame() {
  balls.forEach(b => Matter.World.remove(engine.world, b));
  balls     = [];
  gameState = 'idle';

  document.getElementById('winner-banner').style.display = 'none';
  document.getElementById('banner-content').classList.remove('banner-filter');
  document.getElementById('start-btn').style.display = '';

  initGame();
  updateHud();
}

// ─── Banners ───────────────────────────────────────────────────────────────
const MEDALS = ['🏆', '🥈', '🥉'];

function showWinnerBanner() {
  const banner  = document.getElementById('winner-banner');
  const content = document.getElementById('banner-content');
  const title   = document.getElementById('banner-title');
  const list    = document.getElementById('winner-list');
  const nextBtn = document.getElementById('next-stage-btn');
  const newBtn  = document.getElementById('new-game-btn');

  content.classList.remove('banner-filter');
  title.textContent = '🏆 Winners! 🏆';
  list.innerHTML = winners.map((w, i) => `
    <div class="winner-item">
      <span class="medal">${MEDALS[i] ?? `${i + 1}.`}</span>
      <span class="winner-emoji">${w.emoji}</span>
      <span class="winner-name">${escapeHtml(w.name)}</span>
    </div>`).join('');

  nextBtn.style.display = 'none';
  newBtn.style.display  = '';

  banner.style.display = 'flex';
  banner.classList.remove('banner-animate');
  void banner.offsetWidth;
  banner.classList.add('banner-animate');
}

function showFilterBanner() {
  const banner  = document.getElementById('winner-banner');
  const content = document.getElementById('banner-content');
  const title   = document.getElementById('banner-title');
  const list    = document.getElementById('winner-list');
  const nextBtn = document.getElementById('next-stage-btn');
  const newBtn  = document.getElementById('new-game-btn');

  content.classList.add('banner-filter');
  title.textContent = `✅ Stage ${stageNumber} Complete — ${stageCaptures.length} advance`;
  list.innerHTML = stageCaptures.map((w, i) => `
    <div class="winner-item">
      <span class="medal advance-num">${i + 1}</span>
      <span class="winner-emoji">${w.emoji}</span>
      <span class="winner-name">${escapeHtml(w.name)}</span>
    </div>`).join('');

  nextBtn.style.display = '';
  newBtn.style.display  = 'none';

  banner.style.display = 'flex';
  banner.classList.remove('banner-animate');
  void banner.offsetWidth;
  banner.classList.add('banner-animate');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ─── Custom canvas overlay (bucket + ball labels) ──────────────────────────
function drawOverlay() {
  const ctx = render.context;

  drawBucket(ctx);

  balls.forEach(ball => {
    if (!ball.participant) return;
    const { x, y } = ball.position;
    drawBallLabel(ctx, ball.participant, x, y);
  });
}

function drawBucket(ctx) {
  const left  = W / 2 - GAP_WIDTH / 2;
  const right = W / 2 + GAP_WIDTH / 2;
  const top   = FUNNEL_BOT_Y;
  const btm   = BUCKET_BOT_Y;

  ctx.save();

  // Glow fill
  const grad = ctx.createLinearGradient(W / 2, top, W / 2, btm);
  grad.addColorStop(0, 'rgba(255,215,0,0.04)');
  grad.addColorStop(1, 'rgba(255,215,0,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(left, top, GAP_WIDTH, btm - top);

  // Side walls
  ctx.strokeStyle = 'rgba(255,215,0,0.55)';
  ctx.lineWidth   = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(left,  top);  ctx.lineTo(left,  btm);
  ctx.moveTo(right, top);  ctx.lineTo(right, btm);
  ctx.stroke();

  // Bottom wall
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(left, btm);  ctx.lineTo(right, btm);
  ctx.stroke();

  // Trophy label
  ctx.setLineDash([]);
  ctx.font         = `${Math.min(28, BALL_R * 1.1)}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  ctx.globalAlpha  = 0.45;
  ctx.fillStyle    = '#ffd700';
  ctx.fillText('🏆', W / 2, btm - 4);
  ctx.globalAlpha  = 1;

  ctx.restore();
}

function drawBallLabel(ctx, participant, x, y) {
  ctx.save();
  ctx.translate(x, y);

  // Emoji — smaller, centred in upper half of ball
  ctx.font         = `${Math.round(BALL_R * 0.62)}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(participant.emoji, 0, -BALL_R * 0.32);

  // Name — dominant text, larger, centred in lower half
  const name     = participant.name.length > 9 ? participant.name.slice(0, 8) + '…' : participant.name;
  const fontSize = Math.max(10, Math.round(BALL_R * 0.44));
  ctx.font         = `900 ${fontSize}px Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.strokeStyle  = 'rgba(0,0,0,0.95)';
  ctx.lineWidth    = 3.5;
  ctx.strokeText(name, 0, BALL_R * 0.42);
  ctx.fillStyle    = '#ffffff';
  ctx.fillText(name,   0, BALL_R * 0.42);

  ctx.restore();
}

// ─── Initialisation ────────────────────────────────────────────────────────
async function fetchState() {
  const res  = await fetch('/api/state');
  stateData  = await res.json();
  updateHud();
  renderCustomBanner();
}

function renderCustomBanner() {
  const el    = document.getElementById('custom-banner');
  const bdata = stateData.banner;
  if (!bdata || bdata.type === 'none') {
    el.style.display = 'none';
    el.innerHTML     = '';
    return;
  }
  if (bdata.type === 'text') {
    el.innerHTML     = `<div class="custom-banner-text banner-style-${bdata.style}">${escapeHtml(bdata.text)}</div>`;
    el.style.display = '';
    return;
  }
  if (bdata.type === 'image' && typeof bdata.image_data === 'string'
      && bdata.image_data.startsWith('data:image/')) {
    el.innerHTML     = `<img class="custom-banner-img" src="${bdata.image_data}" alt="Event banner">`;
    el.style.display = '';
    return;
  }
  el.style.display = 'none';
  el.innerHTML     = '';
}

function updateStartBtn() {
  const btn = document.getElementById('start-btn');
  if (!btn) return;
  const n = activeParticipants.length;
  if (n === 0) { btn.textContent = '🎲 Start Round'; return; }
  const finale = n <= stateData.config.winners_count * 2;
  btn.textContent = finale
    ? `🏆 Start Final (${n} players)`
    : `▶ Start Stage ${stageNumber} (${n} players)`;
}

function updateHud() {
  const el    = document.getElementById('participant-count');
  const stage = document.getElementById('stage-indicator');
  if (el) {
    el.textContent =
      `${stateData.participants.length} participants · ` +
      `${stateData.config.winners_count} winner(s) · ` +
      `${stateData.config.speed} speed`;
  }
  if (stage) {
    const showStage = stageNumber > 1 || gameState !== 'idle';
    if (showStage) {
      const finale = isFinale || activeParticipants.length <= stateData.config.winners_count * 2;
      const label  = finale ? 'Final' : `Stage ${stageNumber}`;
      stage.textContent   = `${label} · ${activeParticipants.length} players`;
      stage.style.display = '';
    } else {
      stage.textContent   = '';
      stage.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await fetchState();
  initGame();
  setupWorld();

  document.getElementById('start-btn').addEventListener('click', beginStage);
  document.getElementById('next-stage-btn').addEventListener('click', advanceToNextStage);
  document.getElementById('new-game-btn').addEventListener('click', resetGame);

  // Poll for admin changes while idle at stage 1
  setInterval(async () => {
    if (gameState === 'idle') {
      await fetchState();
      if (stageNumber === 1) {
        activeParticipants = [...stateData.participants];
        updateStartBtn();
      }
    }
  }, 4000);
});
