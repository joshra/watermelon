(() => {
  "use strict";

  const {
    Body,
    Bodies,
    Composite,
    Engine,
    Events,
    Vector,
  } = Matter;

  const WIDTH = 480;
  const HEIGHT = 720;
  const FIXED_STEP = 1000 / 60;
  const FIELD = {
    left: 24,
    right: 456,
    bottom: 704,
    wall: 24,
  };
  const DANGER_Y = 125;
  const SPAWN_Y = 86;
  const DROP_COOLDOWN = 450;
  const GAME_OVER_HOLD = 2000;
  const FRESH_DROP_GRACE = 1500;
  const SOUND_STORAGE_KEY = "suikaSoundEnabled";
  const UI_FONT = '"Hiragino Maru Gothic ProN", "Yuanti TC", "Arial Rounded MT Bold", ui-rounded, "SF Pro Rounded", "PingFang TC", system-ui, sans-serif';

  const FRUITS = [
    { level: 1, name: "櫻桃", key: "cherry", radius: 16, score: 0, color: "#ef4444" },
    { level: 2, name: "草莓", key: "strawberry", radius: 22, score: 2, color: "#f43f5e" },
    { level: 3, name: "葡萄", key: "grape", radius: 28, score: 4, color: "#7c3aed" },
    { level: 4, name: "橘子", key: "orange", radius: 35, score: 8, color: "#f97316" },
    { level: 5, name: "蘋果", key: "apple", radius: 42, score: 16, color: "#ef4444" },
    { level: 6, name: "梨子", key: "pear", radius: 50, score: 32, color: "#a3e635" },
    { level: 7, name: "桃子", key: "peach", radius: 59, score: 64, color: "#fb923c" },
    { level: 8, name: "鳳梨", key: "pineapple", radius: 69, score: 128, color: "#facc15" },
    { level: 9, name: "哈密瓜", key: "cantaloupe", radius: 80, score: 256, color: "#bef264" },
    { level: 10, name: "椰子", key: "coconut", radius: 92, score: 512, color: "#92400e" },
    { level: 11, name: "西瓜", key: "watermelon", radius: 106, score: 1024, color: "#16a34a" },
  ];

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreValue = document.getElementById("scoreValue");
  const currentFruitImg = document.getElementById("currentFruitImg");
  const nextFruitImg = document.getElementById("nextFruitImg");
  const currentFruitName = document.getElementById("currentFruitName");
  const nextFruitName = document.getElementById("nextFruitName");
  const pauseBtn = document.getElementById("pauseBtn");
  const restartBtn = document.getElementById("restartBtn");
  const soundBtn = document.getElementById("soundBtn");
  const primaryBtn = document.getElementById("primaryBtn");
  const messagePanel = document.getElementById("messagePanel");
  const messageTitle = document.getElementById("messageTitle");
  const messageText = document.getElementById("messageText");

  const engine = Engine.create({
    enableSleeping: false,
    positionIterations: 8,
    velocityIterations: 6,
  });
  engine.gravity.y = 1;

  const fruitBodies = new Map();
  const mergingBodies = new Set();
  const mergeQueue = [];
  const effects = [];
  const images = new Map();
  const audio = {
    context: null,
    master: null,
    enabled: true,
  };

  const state = {
    mode: "ready",
    score: 0,
    currentLevel: 0,
    nextLevel: 1,
    dropX: WIDTH / 2,
    time: 0,
    lastDropAt: -DROP_COOLDOWN,
    dangerHold: 0,
    seed: 1729,
    lastFrame: 0,
    accumulator: 0,
  };

  function readSoundPreference() {
    try {
      return localStorage.getItem(SOUND_STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  }

  function writeSoundPreference() {
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, String(audio.enabled));
    } catch {
      // Sound still works when storage is unavailable.
    }
  }

  function setupAudioContext() {
    if (audio.context || !audio.enabled) return audio.context;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      audio.context = new AudioCtor();
      audio.master = audio.context.createGain();
      audio.master.gain.value = 0.18;
      audio.master.connect(audio.context.destination);
    } catch {
      audio.context = null;
      audio.master = null;
    }
    return audio.context;
  }

  function resumeAudioFromGesture() {
    const context = setupAudioContext();
    if (context && context.state === "suspended") {
      context.resume().catch(() => {});
    }
  }

  function scheduleTone(start, frequency, duration, gain, type = "sine", endFrequency = frequency) {
    if (!audio.enabled) return;
    const context = setupAudioContext();
    if (!context || !audio.master) return;

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const now = context.currentTime;
    const startTime = now + start;
    const endTime = startTime + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), endTime);
    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(gain, startTime + Math.min(0.025, duration * 0.35));
    envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(envelope);
    envelope.connect(audio.master);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.03);
  }

  function playDropSound() {
    scheduleTone(0, 260, 0.08, 0.16, "triangle", 185);
    scheduleTone(0.025, 110, 0.08, 0.1, "sine", 80);
  }

  function playMergeSound(level) {
    const base = 330 + Math.min(level, 10) * 22;
    scheduleTone(0, base, 0.09, 0.12, "sine", base * 1.4);
    scheduleTone(0.055, base * 1.5, 0.11, 0.09, "triangle", base * 1.9);
  }

  function playPauseSound(paused) {
    if (paused) {
      scheduleTone(0, 360, 0.06, 0.08, "sine", 300);
      scheduleTone(0.06, 300, 0.08, 0.07, "sine", 220);
    } else {
      scheduleTone(0, 260, 0.06, 0.08, "sine", 340);
      scheduleTone(0.055, 340, 0.08, 0.07, "sine", 460);
    }
  }

  function playGameOverSound() {
    scheduleTone(0, 300, 0.16, 0.1, "triangle", 190);
    scheduleTone(0.13, 220, 0.2, 0.08, "sine", 120);
  }

  function playRestartSound() {
    scheduleTone(0, 390, 0.07, 0.08, "triangle", 520);
    scheduleTone(0.055, 520, 0.08, 0.08, "triangle", 700);
  }

  function toggleSound() {
    audio.enabled = !audio.enabled;
    writeSoundPreference();
    if (audio.enabled) {
      resumeAudioFromGesture();
      playRestartSound();
    }
    syncHud();
  }

  function seededRandom() {
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    return state.seed / 0x100000000;
  }

  function randomDropLevel() {
    return Math.floor(seededRandom() * 5);
  }

  function loadImages() {
    for (const fruit of FRUITS) {
      const image = new Image();
      image.src = `assets/fruits/${fruit.key}.png`;
      images.set(fruit.key, image);
    }
  }

  function setupCanvasScale() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function setupWorld() {
    const wallOptions = {
      isStatic: true,
      friction: 0.85,
      restitution: 0.05,
      label: "wall",
    };
    Composite.add(engine.world, [
      Bodies.rectangle(
        FIELD.left - FIELD.wall / 2,
        HEIGHT / 2,
        FIELD.wall,
        HEIGHT,
        wallOptions,
      ),
      Bodies.rectangle(
        FIELD.right + FIELD.wall / 2,
        HEIGHT / 2,
        FIELD.wall,
        HEIGHT,
        wallOptions,
      ),
      Bodies.rectangle(
        WIDTH / 2,
        FIELD.bottom + FIELD.wall / 2,
        FIELD.right - FIELD.left + FIELD.wall * 2,
        FIELD.wall,
        wallOptions,
      ),
    ]);
  }

  function resetGame() {
    Composite.clear(engine.world, false);
    fruitBodies.clear();
    mergingBodies.clear();
    mergeQueue.length = 0;
    effects.length = 0;
    state.mode = "ready";
    state.score = 0;
    state.currentLevel = randomDropLevel();
    state.nextLevel = randomDropLevel();
    state.dropX = WIDTH / 2;
    state.time = 0;
    state.lastDropAt = -DROP_COOLDOWN;
    state.dangerHold = 0;
    state.accumulator = 0;
    Engine.clear(engine);
    setupWorld();
    syncHud();
    render();
  }

  function clampDropX(x, level = state.currentLevel) {
    const radius = FRUITS[level].radius;
    return Math.max(FIELD.left + radius, Math.min(FIELD.right - radius, x));
  }

  function createFruit(level, x, y) {
    const fruit = FRUITS[level];
    const body = Bodies.circle(x, y, fruit.radius, {
      label: "fruit",
      restitution: 0.12,
      friction: 0.72,
      frictionAir: 0.012,
      density: 0.0012 + level * 0.00008,
      slop: 0.02,
    });
    Body.setAngularVelocity(body, (seededRandom() - 0.5) * 0.04);
    fruitBodies.set(body, {
      level,
      createdAt: state.time,
    });
    Composite.add(engine.world, body);
    return body;
  }

  function canDrop() {
    return (
      (state.mode === "ready" || state.mode === "playing") &&
      state.time - state.lastDropAt >= DROP_COOLDOWN
    );
  }

  function dropCurrentFruit() {
    if (!canDrop()) return false;
    state.mode = "playing";
    const x = clampDropX(state.dropX);
    createFruit(state.currentLevel, x, SPAWN_Y);
    state.lastDropAt = state.time;
    state.currentLevel = state.nextLevel;
    state.nextLevel = randomDropLevel();
    state.dropX = clampDropX(state.dropX);
    playDropSound();
    syncHud();
    return true;
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
      playPauseSound(true);
    } else if (state.mode === "paused") {
      state.mode = "playing";
      playPauseSound(false);
    }
    syncHud();
    render();
  }

  async function toggleFullscreen() {
    const target = document.querySelector(".play-wrap");
    if (!document.fullscreenElement) {
      await target.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
    setupCanvasScale();
  }

  function getFruitInfo(body) {
    const data = fruitBodies.get(body);
    if (!data) return null;
    return { body, data, fruit: FRUITS[data.level] };
  }

  function queueMerge(bodyA, bodyB) {
    const a = getFruitInfo(bodyA);
    const b = getFruitInfo(bodyB);
    if (!a || !b) return;
    if (a.data.level !== b.data.level || a.data.level >= FRUITS.length - 1) return;
    if (mergingBodies.has(bodyA.id) || mergingBodies.has(bodyB.id)) return;
    mergingBodies.add(bodyA.id);
    mergingBodies.add(bodyB.id);
    mergeQueue.push({
      bodyA,
      bodyB,
      nextLevel: a.data.level + 1,
    });
  }

  function processMergeQueue() {
    let merged = false;
    while (mergeQueue.length) {
      const merge = mergeQueue.shift();
      const a = getFruitInfo(merge.bodyA);
      const b = getFruitInfo(merge.bodyB);
      mergingBodies.delete(merge.bodyA.id);
      mergingBodies.delete(merge.bodyB.id);
      if (!a || !b) continue;
      const position = Vector.mult(Vector.add(merge.bodyA.position, merge.bodyB.position), 0.5);
      const velocity = Vector.mult(Vector.add(merge.bodyA.velocity, merge.bodyB.velocity), 0.35);
      Composite.remove(engine.world, merge.bodyA);
      Composite.remove(engine.world, merge.bodyB);
      fruitBodies.delete(merge.bodyA);
      fruitBodies.delete(merge.bodyB);
      const newBody = createFruit(merge.nextLevel, position.x, position.y);
      Body.setVelocity(newBody, velocity);
      const points = FRUITS[merge.nextLevel].score;
      state.score += points;
      merged = true;
      playMergeSound(merge.nextLevel);
      const particles = Array.from({ length: 8 }, () => ({
        angle: seededRandom() * Math.PI * 2,
        speed: 20 + seededRandom() * 34,
        size: 4 + seededRandom() * 4,
        lift: 10 + seededRandom() * 18,
      }));
      effects.push({
        x: position.x,
        y: position.y,
        points,
        life: 420,
        maxLife: 420,
        color: FRUITS[merge.nextLevel].color,
        particles,
      });
    }
    if (merged) syncHud();
  }

  function updateGameOverTimer(dt) {
    if (state.mode !== "playing") {
      state.dangerHold = 0;
      return;
    }
    let stableAboveLine = false;
    for (const [body, data] of fruitBodies) {
      const fruit = FRUITS[data.level];
      const age = state.time - data.createdAt;
      const top = body.position.y - fruit.radius;
      const settled = age > FRESH_DROP_GRACE && body.speed < 0.55;
      if (top < DANGER_Y && settled) {
        stableAboveLine = true;
        break;
      }
    }
    state.dangerHold = stableAboveLine ? state.dangerHold + dt : 0;
    if (state.dangerHold >= GAME_OVER_HOLD) {
      state.mode = "gameover";
      playGameOverSound();
      syncHud();
    }
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      effects[i].life -= dt;
      if (effects[i].life <= 0) effects.splice(i, 1);
    }
  }

  function step(dt) {
    state.time += dt;
    if (state.mode === "playing") {
      Engine.update(engine, dt);
      processMergeQueue();
      updateGameOverTimer(dt);
    }
    updateEffects(dt);
  }

  function tick(now) {
    if (!state.lastFrame) state.lastFrame = now;
    const elapsed = Math.min(100, now - state.lastFrame);
    state.lastFrame = now;
    state.accumulator += elapsed;
    while (state.accumulator >= FIXED_STEP) {
      step(FIXED_STEP);
      state.accumulator -= FIXED_STEP;
    }
    render();
    requestAnimationFrame(tick);
  }

  function roundedRectPath(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawFruitShadow(x, y, radius, alpha = 0.18) {
    ctx.save();
    ctx.translate(x, y + radius * 0.62);
    ctx.scale(1.15, 0.42);
    const shadow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.04);
    shadow.addColorStop(0, `rgba(24, 37, 32, ${alpha})`);
    shadow.addColorStop(1, "rgba(24, 37, 32, 0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFruitImage(body, level, alpha = 1, overrideRadius = null) {
    const fruit = FRUITS[level];
    const image = images.get(fruit.key);
    const radius = overrideRadius || fruit.radius;
    const size = radius * 2.35;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle || 0);
    if (image && image.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = fruit.color;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBoard() {
    const boardLeft = FIELD.left - 10;
    const boardRight = FIELD.right + 10;
    const boardWidth = boardRight - boardLeft;
    const boardTop = 10;
    const boardHeight = FIELD.bottom - boardTop;
    const dangerProgress = Math.min(1, state.dangerHold / GAME_OVER_HOLD);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#caefff");
    sky.addColorStop(0.48, "#edfdf5");
    sky.addColorStop(1, "#fff1dd");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(104, 96, 10, 104, 96, 180);
    glow.addColorStop(0, "rgba(255, 247, 199, 0.94)");
    glow.addColorStop(0.4, "rgba(255, 247, 199, 0.28)");
    glow.addColorStop(1, "rgba(255, 247, 199, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (const orb of [
      { x: 88, y: 164, r: 38, color: "rgba(255, 255, 255, 0.32)" },
      { x: 402, y: 132, r: 52, color: "rgba(209, 248, 255, 0.28)" },
      { x: 426, y: 598, r: 64, color: "rgba(255, 227, 192, 0.18)" },
    ]) {
      ctx.fillStyle = orb.color;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = "rgba(53, 73, 61, 0.14)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 16;
    roundedRectPath(boardLeft, boardTop, boardWidth, boardHeight, 24);
    const interior = ctx.createLinearGradient(0, boardTop, 0, FIELD.bottom);
    interior.addColorStop(0, "rgba(255, 254, 247, 0.98)");
    interior.addColorStop(0.6, "rgba(242, 252, 248, 0.98)");
    interior.addColorStop(1, "rgba(233, 244, 233, 0.98)");
    ctx.fillStyle = interior;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRectPath(boardLeft, boardTop, boardWidth, boardHeight, 24);
    ctx.clip();
    const shimmer = ctx.createLinearGradient(boardLeft, boardTop, boardRight, FIELD.bottom);
    shimmer.addColorStop(0, "rgba(255, 255, 255, 0.26)");
    shimmer.addColorStop(0.45, "rgba(255, 255, 255, 0)");
    shimmer.addColorStop(1, "rgba(255, 230, 204, 0.1)");
    ctx.fillStyle = shimmer;
    ctx.fillRect(boardLeft, boardTop, boardWidth, boardHeight);
    ctx.fillStyle = "rgba(138, 194, 167, 0.05)";
    for (let y = boardTop + 18; y < FIELD.bottom; y += 38) {
      ctx.fillRect(boardLeft + 14, y, boardWidth - 28, 2);
    }
    ctx.restore();

    ctx.strokeStyle = "#7da56f";
    ctx.lineWidth = 10;
    roundedRectPath(boardLeft, boardTop, boardWidth, boardHeight, 24);
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = `rgba(237, 122, 93, ${0.18 + dangerProgress * 0.25})`;
    ctx.shadowBlur = 18 + dangerProgress * 10;
    ctx.strokeStyle = `rgba(235, 122, 93, ${0.6 + dangerProgress * 0.25})`;
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(boardLeft + 6, DANGER_Y);
    ctx.lineTo(boardRight - 6, DANGER_Y);
    ctx.stroke();
    ctx.restore();

    ctx.setLineDash([]);
    roundedRectPath(boardRight - 88, DANGER_Y - 24, 72, 22, 11);
    ctx.fillStyle = "rgba(255, 250, 247, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(235, 122, 93, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#dd7258";
    ctx.font = `800 11px ${UI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("危險線", boardRight - 52, DANGER_Y - 13);
    ctx.textBaseline = "alphabetic";
  }

  function drawDropGuide() {
    if (state.mode === "paused" || state.mode === "gameover") return;
    const level = state.currentLevel;
    const radius = FRUITS[level].radius;
    const x = clampDropX(state.dropX, level);
    const active = canDrop();
    ctx.save();
    const guide = ctx.createLinearGradient(x, 24, x, SPAWN_Y + radius + 12);
    guide.addColorStop(0, "rgba(76, 122, 85, 0)");
    guide.addColorStop(0.18, `rgba(76, 122, 85, ${active ? 0.2 : 0.08})`);
    guide.addColorStop(1, `rgba(76, 122, 85, ${active ? 0.55 : 0.22})`);
    ctx.strokeStyle = guide;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, SPAWN_Y + radius + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = active ? "rgba(255, 255, 255, 0.82)" : "rgba(255, 255, 255, 0.46)";
    ctx.beginPath();
    ctx.arc(x, 24, 7, 0, Math.PI * 2);
    ctx.fill();
    drawFruitShadow(x, SPAWN_Y, radius, active ? 0.14 : 0.08);
    drawFruitImage({ position: { x, y: SPAWN_Y }, angle: 0 }, level, active ? 0.68 : 0.34, radius);
    ctx.restore();
  }

  function drawFruits() {
    const bodies = Array.from(fruitBodies.entries()).sort(
      ([a], [b]) => a.position.y - b.position.y,
    );
    for (const [body, data] of bodies) {
      const fruit = FRUITS[data.level];
      drawFruitShadow(body.position.x, body.position.y, fruit.radius, 0.18);
      drawFruitImage(body, data.level, 1);
    }
  }

  function drawEffects() {
    for (const effect of effects) {
      const t = Math.max(0, effect.life / effect.maxLife);
      const progress = 1 - t;
      ctx.save();
      ctx.globalAlpha = t;
      for (const particle of effect.particles) {
        const distance = particle.speed * progress;
        const px = effect.x + Math.cos(particle.angle) * distance;
        const py = effect.y + Math.sin(particle.angle) * distance - particle.lift * progress;
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(px, py, particle.size * (0.3 + t * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 18 + progress * 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      roundedRectPath(effect.x - 34, effect.y - 38 - progress * 16, 68, 28, 14);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.74)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#de7658";
      ctx.font = `900 18px ${UI_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${effect.points}`, effect.x, effect.y - 24 - progress * 16);
      ctx.restore();
    }
  }

  function render() {
    drawBoard();
    drawDropGuide();
    drawFruits();
    drawEffects();
  }

  function syncHud() {
    const current = FRUITS[state.currentLevel];
    const next = FRUITS[state.nextLevel];
    scoreValue.textContent = String(state.score);
    currentFruitName.textContent = current.name;
    nextFruitName.textContent = next.name;
    currentFruitImg.src = `assets/fruits/${current.key}.png`;
    nextFruitImg.src = `assets/fruits/${next.key}.png`;
    pauseBtn.textContent = state.mode === "paused" ? "繼續" : "暫停";
    pauseBtn.disabled = state.mode === "ready" || state.mode === "gameover";
    soundBtn.textContent = audio.enabled ? "音效開" : "音效關";
    soundBtn.setAttribute("aria-pressed", String(audio.enabled));

    if (state.mode === "ready") {
      messagePanel.classList.remove("is-hidden");
      messageTitle.textContent = "準備開始";
      messageText.textContent = "移動到想落下的位置，開始第一顆水果。";
      primaryBtn.textContent = "開始";
    } else if (state.mode === "paused") {
      messagePanel.classList.remove("is-hidden");
      messageTitle.textContent = "暫停";
      messageText.textContent = `目前分數 ${state.score}`;
      primaryBtn.textContent = "繼續";
    } else if (state.mode === "gameover") {
      messagePanel.classList.remove("is-hidden");
      messageTitle.textContent = "遊戲結束";
      messageText.textContent = `最終分數 ${state.score}`;
      primaryBtn.textContent = "重開";
    } else {
      messagePanel.classList.add("is-hidden");
    }
  }

  function pointerToCanvasX(event) {
    const rect = canvas.getBoundingClientRect();
    return ((event.clientX - rect.left) / rect.width) * WIDTH;
  }

  function handlePointerMove(event) {
    event.preventDefault();
    state.dropX = clampDropX(pointerToCanvasX(event));
    render();
  }

  function handlePointerDown(event) {
    event.preventDefault();
    resumeAudioFromGesture();
    state.dropX = clampDropX(pointerToCanvasX(event));
    if (dropCurrentFruit()) {
      render();
    }
  }

  function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft") {
      event.preventDefault();
      state.dropX = clampDropX(state.dropX - 20);
      render();
    } else if (key === "arrowright") {
      event.preventDefault();
      state.dropX = clampDropX(state.dropX + 20);
      render();
    } else if (event.code === "Space") {
      event.preventDefault();
      resumeAudioFromGesture();
      dropCurrentFruit();
    } else if (key === "p") {
      event.preventDefault();
      resumeAudioFromGesture();
      togglePause();
    } else if (key === "r") {
      event.preventDefault();
      resumeAudioFromGesture();
      playRestartSound();
      resetGame();
    } else if (key === "f") {
      event.preventDefault();
      toggleFullscreen();
    }
  }

  function renderGameToText() {
    const current = FRUITS[state.currentLevel];
    const next = FRUITS[state.nextLevel];
    const fruits = Array.from(fruitBodies.entries())
      .map(([body, data]) => {
        const fruit = FRUITS[data.level];
        return {
          id: body.id,
          level: fruit.level,
          name: fruit.name,
          x: Number(body.position.x.toFixed(2)),
          y: Number(body.position.y.toFixed(2)),
          radius: fruit.radius,
          vx: Number(body.velocity.x.toFixed(3)),
          vy: Number(body.velocity.y.toFixed(3)),
          speed: Number(body.speed.toFixed(3)),
          ageMs: Math.max(0, Math.round(state.time - data.createdAt)),
        };
      })
      .sort((a, b) => a.y - b.y);
    return JSON.stringify({
      coordinateSystem: "Canvas logical pixels. Origin is top-left. X increases right, Y increases down. Size is 480x720.",
      gameState: state.mode,
      score: state.score,
      currentFruit: {
        level: current.level,
        name: current.name,
        radius: current.radius,
        dropX: Number(clampDropX(state.dropX).toFixed(2)),
      },
      nextFruit: {
        level: next.level,
        name: next.name,
        radius: next.radius,
      },
      dangerLineY: DANGER_Y,
      paused: state.mode === "paused",
      gameOver: state.mode === "gameover",
      soundEnabled: audio.enabled,
      cooldownRemainingMs: Math.max(0, Math.ceil(DROP_COOLDOWN - (state.time - state.lastDropAt))),
      fruitCount: fruits.length,
      fruits,
    });
  }

  Events.on(engine, "collisionStart", (event) => {
    if (state.mode !== "playing") return;
    for (const pair of event.pairs) {
      queueMerge(pair.bodyA, pair.bodyB);
    }
  });

  canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
  canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", setupCanvasScale);
  document.addEventListener("fullscreenchange", setupCanvasScale);
  soundBtn.addEventListener("click", () => {
    toggleSound();
  });
  pauseBtn.addEventListener("click", () => {
    resumeAudioFromGesture();
    togglePause();
  });
  restartBtn.addEventListener("click", () => {
    resumeAudioFromGesture();
    playRestartSound();
    resetGame();
  });
  primaryBtn.addEventListener("click", () => {
    resumeAudioFromGesture();
    if (state.mode === "paused") {
      togglePause();
    } else if (state.mode === "gameover") {
      playRestartSound();
      resetGame();
    } else {
      dropCurrentFruit();
    }
  });

  window.render_game_to_text = renderGameToText;
  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.ceil(ms / FIXED_STEP));
    for (let i = 0; i < steps; i += 1) {
      step(FIXED_STEP);
    }
    syncHud();
    render();
  };

  audio.enabled = readSoundPreference();
  loadImages();
  resetGame();
  setupCanvasScale();
  requestAnimationFrame(tick);
})();
