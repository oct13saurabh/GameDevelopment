const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const URL = process.argv[2] || 'http://localhost:8000';
const GAME_WIDTH = 640;
const GAME_HEIGHT = 720;
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3 };
const DEBUG_PORT = Number(process.env.MOBILE_CHECK_PORT || 9223);
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

function findChrome() {
  const found = CHROME_PATHS.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Chrome or Edge was not found in the expected install paths.');
  return found;
}

function launchChrome() {
  const profileDir = path.join(__dirname, '..', '.tmp-chrome-mobile-check');
  fs.mkdirSync(profileDir, { recursive: true });
  return spawn(findChrome(), [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--touch-events=enabled',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
}

async function connectToPage() {
  const targets = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    if (!response.ok) return null;
    const list = await response.json();
    return list.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
  }, 'Chrome debug target');

  const ws = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(`${message.error.message}: ${message.error.data || ''}`));
    else resolve(message.result);
  });

  function send(method, params = {}) {
    const messageId = ++id;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve, reject) => pending.set(messageId, { resolve, reject }));
  }

  return { ws, send };
}

async function main() {
  const chrome = launchChrome();
  const chromeErrors = [];
  chrome.stderr.on('data', (chunk) => {
    const text = String(chunk);
    if (/ERROR|Failed/i.test(text)) chromeErrors.push(text.trim());
  });

  const cdp = await connectToPage();
  const { send } = cdp;
  const pageErrors = [];

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
    mobile: true,
    screenOrientation: { type: 'portraitPrimary', angle: 0 },
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5, configurable: true });
      if (!('ontouchstart' in window)) {
        Object.defineProperty(window, 'ontouchstart', { value: null, configurable: true });
      }
    `,
  });

  function evalInPage(expression) {
    return send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }).then((result) => {
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
      }
      return result.result.value;
    });
  }

  await send('Page.navigate', { url: URL });
  await waitFor(
    () => evalInPage(`Boolean(window.game && window.game.scene && window.game.scene.isActive('MenuScene'))`),
    'MenuScene'
  );

  const bootState = await evalInPage(`(() => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const game = window.game;
    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      hasTouchStart: 'ontouchstart' in window,
      maxTouchPoints: navigator.maxTouchPoints,
      phaserTouchDetected: game.device.input.touch,
      canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      activeScenes: game.scene.getScenes(true).map((scene) => scene.scene.key),
    };
  })()`);

  function toClient(point) {
    const rect = bootState.canvas;
    return {
      x: Math.round(rect.left + point.x * rect.width / GAME_WIDTH),
      y: Math.round(rect.top + point.y * rect.height / GAME_HEIGHT),
    };
  }

  async function dispatchTouch(type, points) {
    await send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((point, index) => ({
        x: point.x,
        y: point.y,
        id: point.id || index + 1,
        radiusX: 8,
        radiusY: 8,
        force: 1,
      })),
    });
  }

  async function tapGame(x, y) {
    const p = toClient({ x, y });
    await dispatchTouch('touchStart', [p]);
    await delay(80);
    await dispatchTouch('touchEnd', []);
    await delay(220);
  }

  async function dragGame(pathPoints) {
    const [start, ...rest] = pathPoints.map(toClient);
    await dispatchTouch('touchStart', [start]);
    await delay(80);
    for (const point of rest) {
      await dispatchTouch('touchMove', [point]);
      await delay(140);
    }
    await dispatchTouch('touchEnd', []);
  }

  await tapGame(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 130);
  await waitFor(
    () => evalInPage(`Boolean(window.game && window.game.scene && window.game.scene.isActive('GameScene'))`),
    'GameScene',
    9000
  );

  await delay(500);
  const beforeDrag = await evalInPage(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    const hud = window.game.scene.getScene('HUDScene');
    return {
      isTouchDevice: scene.isTouchDevice,
      inputType: scene.inputType,
      autoFire: scene.autoFire,
      pointerSlots: scene.input.manager.pointersTotal,
      hudActive: window.game.scene.isActive('HUDScene'),
      touchButtons: hud.children.list
        .filter((child) => child.type === 'Text' && ['BOMB', 'EMP'].includes(child.text))
        .map((child) => child.text),
      player: {
        x: scene.player.sprite.x,
        y: scene.player.sprite.y,
        pointerTargetX: scene.player.pointerTargetX,
        pointerTargetY: scene.player.pointerTargetY,
        bombCount: scene.player.bombCount,
        empCount: scene.player.empCount,
      },
    };
  })()`);

  await dragGame([
    { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 120 },
    { x: 130, y: GAME_HEIGHT - 170 },
    { x: 130, y: GAME_HEIGHT - 250 },
  ]);
  await delay(800);

  const afterDrag = await evalInPage(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    return {
      player: {
        x: scene.player.sprite.x,
        y: scene.player.sprite.y,
        pointerTargetX: scene.player.pointerTargetX,
        pointerTargetY: scene.player.pointerTargetY,
        velocityX: scene.player.velX,
        velocityY: scene.player.velY,
      },
    };
  })()`);

  await tapGame(GAME_WIDTH - 54, GAME_HEIGHT - 130);
  await delay(200);

  const afterBombTap = await evalInPage(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    return {
      player: {
        x: scene.player.sprite.x,
        y: scene.player.sprite.y,
        pointerTargetX: scene.player.pointerTargetX,
        pointerTargetY: scene.player.pointerTargetY,
        bombCount: scene.player.bombCount,
        empCount: scene.player.empCount,
      },
    };
  })()`);

  const ok = beforeDrag.isTouchDevice
    && beforeDrag.inputType === 'mouse'
    && beforeDrag.autoFire === true
    && beforeDrag.touchButtons.includes('BOMB')
    && beforeDrag.touchButtons.includes('EMP')
    && afterDrag.player.pointerTargetX !== null
    && afterDrag.player.x < beforeDrag.player.x - 5
    && Math.abs(afterBombTap.player.pointerTargetX - afterDrag.player.pointerTargetX) < 1;

  console.log(JSON.stringify({
    ok,
    bootState,
    beforeDrag,
    afterDrag,
    afterBombTap,
    pageErrors,
    chromeErrors: chromeErrors.slice(0, 5),
  }, null, 2));

  cdp.ws.close();
  chrome.kill();
}

const keepAlive = setInterval(() => {}, 1000);
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearInterval(keepAlive));
