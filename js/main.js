/**
 * 시작점: 3D 전시장을 만들고, 캐릭터를 세우고, 3인칭 카메라로 걷게 합니다.
 * 이번 단계 범위 = 빈 전시장 보행 데모 + 작품 근접 감지/하이라이트/안내.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { UI } from './ui.js';
import { buildHall } from './hall.js';
import { buildArtworks, setHighlight } from './artworks.js';
import { loadWorks } from './works-data.js';
import { Avatar } from './avatar.js';
import { ThirdPersonControls } from './controls.js';

const ui = new UI(CONFIG);
const canvas = document.getElementById('scene');
const isTouch =
  typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
ui.setTouch(isTouch);
ui.setProgress(0.04, '3D 전시장을 준비하고 있습니다');

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const debug = /[?&]debug=1/.test(location.search);
if (debug) ui.debug.classList.add('show');

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

/** 월드 → 화면 좌표 */
const _v = new THREE.Vector3();
function project(x, y, z, width, height) {
  _v.set(x, y, z).project(app.camera);
  return {
    x: (_v.x * 0.5 + 0.5) * width,
    y: (-_v.y * 0.5 + 0.5) * height,
    behind: _v.z > 1,
  };
}

const app = {
  ready: false,
  near: null,
  selected: null,
  works: [],
  dataWarnings: [],
};

async function boot() {
  // 작품 목록(works.json)은 3D 를 켜기 전에 읽습니다. 그래야 화면의 작품 수 표시도 맞습니다.
  ui.setProgress(0.1, '작품 목록을 읽는 중');
  try {
    const data = await loadWorks({ artistIds: CONFIG.artists.map((a) => a.id) });
    app.works = data.works;
    app.dataWarnings = data.warnings;
    ui.setWorkCount(app.works.length);
    if (data.warnings.length) ui.toast('works.json 에 확인할 항목이 있습니다 (개발자 도구 콘솔 참고)');
  } catch (e) {
    app.works = [];
    app.dataError = e && e.message ? e.message : String(e);
    ui.setWorkCount(0);
    ui.setDataError(app.dataError);
    ui.toast('작품 목록(works.json)을 읽지 못했습니다');
    console.warn('[전시] ' + app.dataError);
  }

  if (!hasWebGL()) {
    ui.showFallback('WebGL을 사용할 수 없습니다.');
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !(isTouch && !CONFIG.render.antialiasOnMobile),
      powerPreference: 'high-performance',
      alpha: false,
    });
  } catch (e) {
    ui.showFallback('3D 화면을 시작하지 못했습니다.');
    return;
  }

  app.renderer = renderer;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(
    clamp(window.devicePixelRatio || 1, CONFIG.render.minPixelRatio, CONFIG.render.maxPixelRatio)
  );
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.theme.background);
  scene.fog = new THREE.Fog(CONFIG.theme.fog, CONFIG.theme.fogNear, CONFIG.theme.fogFar);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far
  );
  app.scene = scene;
  app.camera = camera;
  applyFov();

  ui.setProgress(0.22, '전시장을 짓는 중');
  await nextFrame();

  const hall = buildHall(scene, renderer);
  app.hall = hall;

  ui.setProgress(0.4, '작품을 거는 중');
  await nextFrame();

  const { pickables } = await buildArtworks(scene, hall.walls, renderer, app.works, (p) => {
    ui.setProgress(0.4 + p * 0.4, `작품을 거는 중 ${Math.round(p * 100)}%`);
  });
  app.pickables = pickables;

  ui.setProgress(0.86, '관람객을 세우는 중');
  await nextFrame();

  const avatar = new Avatar(scene, renderer);
  app.avatar = avatar;

  const controls = new ThirdPersonControls(camera, canvas, {
    colliders: hall.colliders,
    onTap: handleTap,
    onInteract: handleInteract,
  });
  app.controls = controls;
  controls.attachJoystick(ui.joy);
  controls.setEnabled(false);
  controls.snapCamera();

  ui.setProgress(0.96, '마지막 점검');
  await nextFrame();

  // 첫 프레임을 그려 두고 입장 화면을 띄웁니다
  renderFrame();
  app.ready = true;
  ui.setProgress(1, '준비 완료');
  ui.loadingDone();
  setTimeout(() => ui.showEntry(), 340);

  ui.onEnter(() => enter());
  ui.onView(() => handleInteract());

  // 도움말을 열면 캐릭터가 움직이지 않도록
  const helpBtn = document.getElementById('btn-help');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      if (app.controls) app.controls.setEnabled(false);
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (ui.isCardOpen()) {
        ui.hideCard();
      } else if (app.controls && app.controls.enabled) {
        app.controls.setEnabled(false);
        ui.showEntry(true);
      }
    }
  });

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 180));

  requestAnimationFrame(tick);
}

function enter() {
  const help = ui._helpMode;
  ui.hideEntry();
  ui.hideFirstHint();
  if (!app.controls) return;
  app.controls.setEnabled(true);
  if (!help) {
    let visited = false;
    try {
      visited = localStorage.getItem('papa5.visited') === '1';
    } catch (e) {
      /* 저장 못 하는 브라우저 */
    }
    if (!visited) {
      ui.showFirstHint();
      try {
        localStorage.setItem('papa5.visited', '1');
      } catch (e) {
        /* 무시 */
      }
    }
  }
}

/* ── 상호작용 ─────────────────────────────────────────────── */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pickAt(clientX, clientY) {
  if (!app.pickables) return null;
  const r = canvas.getBoundingClientRect();
  ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObjects(
    app.pickables.map((p) => p.mesh),
    false
  );
  if (!hits.length) return null;
  return app.pickables.find((p) => p.mesh === hits[0].object) || null;
}

function handleTap(clientX, clientY) {
  if (!app.controls || !app.controls.enabled) return;
  if (ui.isCardOpen()) return;
  const hit = pickAt(clientX, clientY);
  if (hit && hit === app.near) selectWork(hit);
}

function handleInteract() {
  if (!app.controls || !app.controls.enabled) return;
  if (ui.isCardOpen()) {
    ui.hideCard();
    app.selected = null;
    return;
  }
  if (app.near) selectWork(app.near);
}

function selectWork(pickable) {
  app.selected = pickable;
  ui.showCard(pickable.work, pickable.artist);
}

/* ── 프레임 ───────────────────────────────────────────────── */
function renderFrame() {
  app.renderer.render(app.scene, app.camera);
}

let frames = 0;
let fpsAcc = 0;
let fps = 60;
let lowCount = 0;
let last = performance.now();
let debugTick = 0;

function tick(now) {
  app.rafId = requestAnimationFrame(tick);
  const t = now || performance.now();
  let dt = (t - last) / 1000;
  last = t;
  if (!isFinite(dt) || dt < 0) dt = 0.016;
  dt = Math.min(dt, 0.05);

  if (app.controls) {
    app.controls.update(dt);
    app.avatar.root.position.x = app.controls.pos.x;
    app.avatar.root.position.z = app.controls.pos.y;
    app.avatar.root.rotation.y = app.controls.yaw;
    app.avatar.update(dt, app.controls.speed);
    app.avatar.setVisible(app.controls.dist > CONFIG.camera.minDistance + 0.15);
    updateNearby();
  }

  renderFrame();

  /* FPS · 자동 화질 조정 */
  frames++;
  fpsAcc += dt;
  debugTick++;
  if (fpsAcc >= 1) {
    fps = frames / fpsAcc;
    frames = 0;
    fpsAcc = 0;
    if (fps < 32) {
      lowCount++;
      if (lowCount >= 2 && app.renderer.getPixelRatio() > 1) {
        const next = Math.max(1, app.renderer.getPixelRatio() - 0.25);
        app.renderer.setPixelRatio(next);
        app.renderer.setSize(window.innerWidth, window.innerHeight, false);
        ui.toast('화면 품질을 자동으로 낮췄습니다 (기기 성능)');
        lowCount = 0;
      }
    } else {
      lowCount = 0;
    }
  }

  if (debug && debugTick % 8 === 0 && app.controls) {
    const s = app.controls.getState();
    ui.setDebug(
      `fps ${fps.toFixed(0)}  pix ${app.renderer.getPixelRatio().toFixed(2)}\n` +
        `pos ${s.x}, ${s.z}  yaw ${s.yaw}  cam ${s.dist}\n` +
        `near ${app.near ? app.near.work.title + ' / ' + app.near.artist.name : '-'}\n` +
        `errors ${(window.__papaErrors || []).length}`
    );
  }
}

/** 작품 근접 감지 + 하이라이트 + 안내 표시 */
function updateNearby() {
  const controls = app.controls;
  const px = controls.pos.x;
  const pz = controls.pos.y;
  let best = null;
  let bestD = Infinity;

  for (const p of app.pickables) {
    const dx = px - p.position.x;
    const dz = pz - p.position.z;
    const d = Math.hypot(dx, dz);
    if (d > CONFIG.interaction.range || d >= bestD) continue;
    // 벽 앞쪽에 있는지 (벽 반대편 제외)
    const side = dx * p.normal.x + dz * p.normal.z;
    if (side < CONFIG.interaction.minFacingDot) continue;
    best = p;
    bestD = d;
  }

  if (best !== app.near) {
    if (app.near) setHighlight(app.near, false);
    app.near = best;
    if (app.near) setHighlight(app.near, true);
  }

  if (!app.near || ui.isCardOpen()) {
    ui.hidePill();
    return;
  }

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const p = project(app.near.position.x, app.near.anchorY, app.near.position.z, w, h);
  if (p.behind || p.x < -60 || p.x > w + 60 || p.y < -40 || p.y > h + 40) {
    ui.hidePill();
    return;
  }
  const x = clamp(p.x, 90, w - 90);
  const y = clamp(p.y, 92, h - 40);
  ui.showPill(app.near.work, app.near.artist, x, y);
}

function onResize() {
  if (!app.renderer) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  app.camera.aspect = w / h;
  applyFov();
  app.camera.updateProjectionMatrix();
  app.renderer.setSize(w, h, false);
  if (app.controls) app.controls.snapCamera();
}

/** 세로 화면(폰)에서는 시야각을 조금 넓혀 전시장이 더 보이게 */
function applyFov() {
  if (!app.camera) return;
  const portrait = window.innerWidth / Math.max(1, window.innerHeight) < 0.9;
  app.camera.fov = CONFIG.camera.fov + (portrait ? 6 : 0);
  app.camera.updateProjectionMatrix();
}

/* 검증·디버깅용 핸들 */
window.__papa = {
  get ready() {
    return app.ready;
  },
  get camera() {
    return app.camera;
  },
  get controls() {
    return app.controls;
  },
  get pickables() {
    return app.pickables;
  },
  get works() {
    return app.works;
  },
  get dataError() {
    return app.dataError || null;
  },
  get dataWarnings() {
    return app.dataWarnings;
  },
  get near() {
    return app.near;
  },
  get errors() {
    return window.__papaErrors || [];
  },
  CONFIG,
  ui,
  enter,
  selectNearest() {
    if (app.near) selectWork(app.near);
  },
  /** 검증용: 렌더 루프와 입력을 멈춥니다. */
  stop() {
    cancelAnimationFrame(app.rafId);
    if (app.controls) app.controls.dispose();
    app.ready = false;
  },
};

boot().catch((e) => {
  window.__papaErrors.push('boot: ' + (e && e.message ? e.message : String(e)));
  ui.showFallback(e && e.message ? e.message : '');
});
