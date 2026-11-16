/**
 * 관람객 캐릭터 — 외부 모델 파일(GLB) 없이 코드 지오메트리로만 만듭니다.
 *
 *  · 추상 오브제 3종 (데-모 참고)
 *      prism    — 사각기둥(모노리스형). 가장 기본.
 *      cylinder — 원기둥. 더 부드럽고 조용한 인상.
 *      slab     — 기울어진 얇은 판. 가장 조형적.
 *    얼굴·이목구비 없이 단색 실루엣으로만 읽히고, 상단에서 빛이 새어 나옵니다.
 *    각 오브제는 이동 방향 회전(root.rotation.y)과 별개로 자기 축으로 천천히 돕니다.
 *
 *  · human — 이전 단계의 사람 실루엣(비교용). 형태·애니메이션을 그대로 유지합니다.
 *
 * 전환: setMode('prism' | 'cylinder' | 'slab' | 'human')
 * 비례·발광 설정: js/config.js 의 CONFIG.avatar.forms / CONFIG.avatar.glow
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeShadowTexture, makeGlowTexture } from './textures.js';

const H_REF = 1.72; // 사람 비례 기준 키(m)
export const AVATAR_MODES = ['prism', 'cylinder', 'slab', 'human'];
export const AVATAR_LABELS = {
  prism: '프리즘',
  cylinder: '원기둥',
  slab: '판',
  human: '사람',
};

export class Avatar {
  constructor(scene, renderer, mode) {
    const cfg = CONFIG.avatar;
    this.renderer = renderer;

    this.root = new THREE.Group();
    this.root.name = 'avatar';
    this.root.position.set(CONFIG.space.spawn.x, 0, CONFIG.space.spawn.z);
    this.root.rotation.y = CONFIG.space.spawn.facing || 0;
    scene.add(this.root);

    // body = 모드와 무관하게 상하 흔들림을 담는 그릇
    this.body = new THREE.Group();
    this.root.add(this.body);

    // 공통 재질(모드가 바뀌어도 그대로 씁니다)
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      roughness: 0.86,
      metalness: 0.04,
      emissive: 0x0a0a0c,
      emissiveIntensity: 1,
    });
    // 아주 약한 림: 몸을 아주 살짝 키운 뒷면만 그려 실루엣 테두리처럼 보이게
    this.rimMat = new THREE.MeshBasicMaterial({
      color: cfg.rimColor,
      side: THREE.BackSide,
      transparent: true,
      opacity: cfg.rimOpacity,
      depthWrite: false,
    });
    this.glowMat = new THREE.MeshBasicMaterial({
      color: cfg.glow.color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glowTex = makeGlowTexture(THREE, 'rgba(255,228,176,0.85)', renderer);

    // 오브제 상단의 빛: 포인트 라이트 1개를 공유합니다(모드별로 세기만 조절).
    this.light = new THREE.PointLight(
      cfg.glow.lightColor,
      0,
      cfg.glow.lightDistance,
      2
    );
    this.body.add(this.light);
    this.lightBase = cfg.glow.lightIntensity;

    // 발밑 가짜 그림자
    const shadowTex = makeShadowTexture(THREE, cfg.shadowOpacity || 0.4, renderer);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.root.add(this.shadow);

    this.forms = {}; // mode -> { group, spin, ... }
    this.active = null;
    this.mode = null;
    this.visibleAll = true;

    this.phase = 0;
    this.amp = 0;
    this.time = 0;

    this.setMode(mode || cfg.mode || 'prism');
  }

  /* ── 모드 전환 ─────────────────────────────────────────── */
  setMode(mode) {
    const next = AVATAR_MODES.indexOf(mode) >= 0 ? mode : 'prism';
    if (next === this.mode) return this.mode;

    if (!this.forms[next]) {
      this.forms[next] = next === 'human' ? this._buildHuman() : this._buildObject(next);
      this.body.add(this.forms[next].group);
    }
    if (this.active) this.active.group.visible = false;
    this.active = this.forms[next];
    this.active.group.visible = this.visibleAll;

    const obj = next !== 'human' ? this.active : null;
    if (obj) {
      this.light.position.set(0, obj.lightHeight, 0);
      this.light.intensity = this.lightBase;
      this.shadow.scale.setScalar(obj.shadowScale);
    } else {
      this.light.intensity = 0;
      this.shadow.scale.setScalar(this.active.shadowScale || 1);
    }

    this.mode = next;
    this.time = 0;
    this.phase = 0;
    this.amp = 0;
    return this.mode;
  }

  /* ── 추상 오브제 3종 ──────────────────────────────────── */
  _buildObject(mode) {
    const cfg = CONFIG.avatar;
    const f = cfg.forms[mode] || cfg.forms.prism;
    const H = f.height || 1.66;
    const W = f.width || 0.44;
    const D = f.depth != null ? f.depth : W;

    const group = new THREE.Group();
    group.name = 'avatar-' + mode;
    const spin = new THREE.Group(); // 자기 축 회전(이동 방향 회전과 별개)
    group.add(spin);

    /* 판(slab)은 살짝 기울여 세우므로, 몸체·빛 틈·빛구를 한 그룹에 담아 함께 기웁니다 */
    const tilt = new THREE.Group();
    spin.add(tilt);
    if (mode === 'slab') {
      tilt.rotation.z = f.tilt != null ? f.tilt : 0.13;
      tilt.rotation.x = (f.tiltX != null ? f.tiltX : 0.05);
    }

    let mesh;
    let bandY = H * 0.87;
    let bandGeom;

    if (mode === 'cylinder') {
      const taper = f.taper != null ? f.taper : 0.92;
      const rBot = W / 2;
      const rTop = rBot * taper;
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, H, 28, 1), this.bodyMat);
      mesh.position.y = H / 2;
      const rBand = (rBot + (rTop - rBot) * 0.87) * 1.012;
      bandGeom = new THREE.CylinderGeometry(rBand, rBand, 0.012, 28, 1, true);
    } else if (mode === 'slab') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), this.bodyMat);
      mesh.position.y = H / 2;
      bandGeom = new THREE.BoxGeometry(W * 0.985, 0.012, D * 2.4);
    } else {
      // prism — 사각기둥(모노리스)
      mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), this.bodyMat);
      mesh.position.y = H / 2;
      bandGeom = new THREE.BoxGeometry(W * 1.02, 0.012, D * 1.02);
    }

    tilt.add(mesh);

    // 실루엣 테두리(뒷면 셸)
    const shell = new THREE.Mesh(mesh.geometry, this.rimMat);
    shell.scale.setScalar(1.035);
    shell.renderOrder = -1;
    mesh.add(shell);

    // 판은 기울인 만큼 바닥에 닿도록 정확히 올립니다
    if (mode === 'slab') {
      tilt.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(mesh);
      tilt.position.y = -bb.min.y;
    }

    /* 상단에서 새어 나오는 빛 */
    const glow = new THREE.Group();
    glow.position.y = mode === 'slab' ? H + 0.09 : H + 0.01;
    (mode === 'slab' ? tilt : spin).add(glow);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.glow.coreSize || 0.055, 14, 10),
      this.glowMat
    );
    core.renderOrder = 2;
    glow.add(core);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: cfg.glow.color,
        transparent: true,
        opacity: cfg.glow.haloOpacity != null ? cfg.glow.haloOpacity : 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.scale.setScalar(cfg.glow.haloSize || 0.55);
    halo.renderOrder = 3;
    glow.add(halo);

    // 빛이 새는 얇은 틈(상단 부근)
    const band = new THREE.Mesh(
      bandGeom,
      new THREE.MeshBasicMaterial({
        color: cfg.glow.color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    band.position.y = bandY;
    band.renderOrder = 1;
    tilt.add(band);

    return {
      group,
      spin,
      core,
      halo,
      band,
      lightHeight: H * 0.9,
      shadowScale: mode === 'slab' ? 0.78 : 0.82,
      spinRate: f.spin != null ? f.spin : 0.2,
      bobScale: mode === 'slab' ? 0.5 : 0.65,
    };
  }

  /* ── 사람 실루엣 (이전 단계 그대로) ─────────────────────── */
  _buildHuman() {
    const cfg = CONFIG.avatar;
    const S = (cfg.height || H_REF) / H_REF;

    const group = new THREE.Group();
    group.name = 'avatar-human';
    const spin = new THREE.Group(); // 사람은 자전하지 않습니다(형태 유지)
    group.add(spin);

    const body = spin; // 기존 코드의 this.body 자리
    const bodyMat = this.bodyMat;
    const rimMat = this.rimMat;

    // 기본 크기(1.72m 기준) 지오메트리 + 메시 스케일 S
    const addPart = (parent, geom, x, y, z, scaleMul, shell = true) => {
      const m = new THREE.Mesh(geom, bodyMat);
      m.position.set(x * S, y * S, z * S);
      if (scaleMul) m.scale.set(scaleMul[0] * S, scaleMul[1] * S, scaleMul[2] * S);
      else m.scale.setScalar(S);
      parent.add(m);
      if (shell) {
        const sh = new THREE.Mesh(geom, rimMat);
        sh.scale.setScalar(1.045);
        sh.renderOrder = -1;
        m.add(sh);
      }
      return m;
    };

    const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
    const sph = (r, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);

    /* 몸통 */
    addPart(body, cyl(0.148, 0.112, 0.46), 0, 1.26, 0); // 가슴
    addPart(body, cyl(0.12, 0.104, 0.2), 0, 0.97, 0); // 허리~골반
    addPart(body, sph(0.062, 10, 8), -0.176, 1.448, 0); // 어깨
    addPart(body, sph(0.062, 10, 8), 0.176, 1.448, 0);

    /* 목 · 머리 */
    addPart(body, cyl(0.042, 0.05, 0.09, 10), 0, 1.505, 0);
    addPart(body, sph(0.092, 16, 12), 0, 1.605, 0, [1, 1.07, 1.02]);

    /* 팔 (어깨 피벗에서 회전) */
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.188 * S, 1.435 * S, 0);
      body.add(pivot);
      addPart(pivot, cyl(0.045, 0.039, 0.6, 10), 0, -0.3, 0, null, false);
      addPart(pivot, sph(0.047, 10, 8), 0, -0.618, 0, null, false);
      return pivot;
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);

    /* 다리 (골반 피벗에서 회전) */
    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.083 * S, 0.88 * S, 0);
      body.add(pivot);
      addPart(pivot, cyl(0.058, 0.046, 0.82, 10), 0, -0.41, 0);
      const foot = addPart(pivot, new THREE.BoxGeometry(0.085, 0.052, 0.2), 0, -0.845, -0.045);
      foot.rotation.x = -0.04;
      return pivot;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    return {
      group,
      spin,
      human: { body, armL, armR, legL, legR },
      lightHeight: 1.6,
      shadowScale: 0.95,
    };
  }

  /* ── 프레임 갱신 ──────────────────────────────────────── */
  /** dt: 초, speed: 현재 이동 속도(m/s) */
  update(dt, speed) {
    const cfg = CONFIG.avatar;
    this.time += dt;

    const target = Math.min(1, speed / Math.max(0.1, CONFIG.player.walkSpeed));
    this.amp += (target - this.amp) * Math.min(1, dt * 9);
    this.phase += dt * (2.2 + speed * 2.1);

    if (!this.active) return;

    if (this.mode === 'human') this._updateHuman(dt, cfg);
    else this._updateObject(dt, cfg);

    const bob = this._bob || 0;
    this.shadow.scale.setScalar((this.active.shadowScale || 1) * (1 + bob * 1.2));
  }

  _updateHuman(dt, cfg) {
    const h = this.active.human;
    const swing = cfg.swing * this.amp;
    const s = Math.sin(this.phase);

    h.legL.rotation.x = s * swing;
    h.legR.rotation.x = -s * swing;
    h.armL.rotation.x = -s * swing * 0.75;
    h.armR.rotation.x = s * swing * 0.75;
    h.armL.rotation.z = 0.09;
    h.armR.rotation.z = -0.09;

    const bob = Math.abs(Math.sin(this.phase)) * cfg.bob * this.amp;
    const breathe = Math.sin(this.time * 1.6) * 0.006 * (1 - this.amp);
    this._bob = bob;
    this.body.position.y = bob + breathe;
    this.body.rotation.z = Math.sin(this.phase) * 0.012 * this.amp;
    this.body.rotation.x = -0.045 * this.amp;
  }

  _updateObject(dt, cfg) {
    const a = this.active;
    const glow = cfg.glow;

    // 자기 축으로 천천히 회전 — 이동 방향(root.rotation.y)과 더해집니다
    const rate = (a.spinRate || 0.2) * (1 - 0.3 * this.amp);
    a.spin.rotation.y += dt * rate;

    // 걷는 동안의 아주 작은 흔들림 + 멈춰 있을 때의 느린 부유
    const bob = Math.abs(Math.sin(this.phase)) * cfg.bob * (a.bobScale || 0.6) * this.amp;
    const float = Math.sin(this.time * 0.9) * 0.008 * (1 - this.amp);
    this._bob = bob;
    this.body.position.y = bob + float;
    this.body.rotation.z = Math.sin(this.time * 0.63) * 0.006;
    this.body.rotation.x = -0.028 * this.amp;

    // 빛 떨림
    const pulse = 1 + Math.sin(this.time * 1.35) * (glow.pulse != null ? glow.pulse : 0.18);
    this.light.intensity = this.lightBase * pulse;
    if (a.core) a.core.scale.setScalar(pulse);
    if (a.halo) {
      const base = glow.haloOpacity != null ? glow.haloOpacity : 0.55;
      a.halo.material.opacity = base * (0.9 + (pulse - 1) * 0.6);
      a.halo.scale.setScalar((glow.haloSize || 0.55) * (0.96 + (pulse - 1) * 0.5));
    }
    if (a.band) a.band.material.opacity = 0.72 + (pulse - 1) * 0.5;
  }

  setPosition(x, z) {
    this.root.position.x = x;
    this.root.position.z = z;
  }

  setVisible(v) {
    this.visibleAll = !!v;
    this.body.visible = !!v;
    this.shadow.visible = !!v;
  }
}
