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
    left: 36,
    right: 444,
    bottom: 690,
    wall: 28,
  };
  const DANGER_Y = 125;
  const SPAWN_Y = 86;
  const DROP_COOLDOWN = 450;
  const GAME_OVER_HOLD = 2000;
  const FRESH_DROP_GRACE = 1500;

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
    syncHud();
    return true;
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
    } else if (state.mode === "paused") {
      state.mode = "playing";
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
      effects.push({
        x: position.x,
        y: position.y,
        points,
        life: 420,
        maxLife: 420,
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
    const boardLeft = FIELD.left;
    const boardRight = FIELD.right;
    const boardWidth = boardRight - boardLeft;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#dff8ff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#f9fff7";
    ctx.fillRect(boardLeft, 0, boardWidth, FIELD.bottom);

    ctx.fillStyle = "#6b8f64";
    ctx.fillRect(FIELD.left - FIELD.wall, 0, FIELD.wall, FIELD.bottom + FIELD.wall);
    ctx.fillRect(FIELD.right, 0, FIELD.wall, FIELD.bottom + FIELD.wall);
    ctx.fillRect(FIELD.left - FIELD.wall, FIELD.bottom, boardWidth + FIELD.wall * 2, FIELD.wall);

    ctx.fillStyle = "#476b47";
    ctx.fillRect(FIELD.left - FIELD.wall, FIELD.bottom, boardWidth + FIELD.wall * 2, 8);

    ctx.strokeStyle = "rgba(231, 111, 81, 0.8)";
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boardLeft + 6, DANGER_Y);
    ctx.lineTo(boardRight - 6, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(231, 111, 81, 0.9)";
    ctx.font = "700 12px ui-rounded, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("危險線", boardRight - 10, DANGER_Y - 8);
  }

  function drawDropGuide() {
    if (state.mode === "paused" || state.mode === "gameover") return;
    const level = state.currentLevel;
    const radius = FRUITS[level].radius;
    const x = clampDropX(state.dropX, level);
    ctx.save();
    ctx.strokeStyle = "rgba(49, 90, 64, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, SPAWN_Y + radius + 10);
    ctx.stroke();
    drawFruitImage({ position: { x, y: SPAWN_Y }, angle: 0 }, level, canDrop() ? 0.62 : 0.32, radius);
    ctx.restore();
  }

  function drawFruits() {
    const bodies = Array.from(fruitBodies.entries()).sort(
      ([a], [b]) => a.position.y - b.position.y,
    );
    for (const [body, data] of bodies) {
      drawFruitImage(body, data.level, 1);
    }
  }

  function drawEffects() {
    for (const effect of effects) {
      const t = Math.max(0, effect.life / effect.maxLife);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.strokeStyle = `rgba(240, 184, 77, ${t})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 18 + (1 - t) * 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#e76f51";
      ctx.font = "800 18px ui-rounded, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`+${effect.points}`, effect.x, effect.y - 18 - (1 - t) * 18);
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

    if (state.mode === "ready") {
      messagePanel.classList.remove("is-hidden");
      messageTitle.textContent = "準備開始";
      messageText.textContent = "移動位置後投放水果";
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
      dropCurrentFruit();
    } else if (key === "p") {
      event.preventDefault();
      togglePause();
    } else if (key === "r") {
      event.preventDefault();
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
  pauseBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", resetGame);
  primaryBtn.addEventListener("click", () => {
    if (state.mode === "paused") {
      togglePause();
    } else if (state.mode === "gameover") {
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

  loadImages();
  resetGame();
  setupCanvasScale();
  requestAnimationFrame(tick);
})();
