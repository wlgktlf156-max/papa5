/**
 * 관람객 캐릭터 — 외부 모델 파일(GLB) 없이 코드 지오메트리로만 만듭니다.
 *
 *  · lowpoly (지금 쓰는 캐릭터)
 *      작은 키에 머리가 조금 큰 로우폴리 인체(기본 1.20m, 머리 지름이 키의 1/4 안팎 → 약 4등신).
 *      면은 낮게(전체 300개 안팎) 두고 flatShading 으로 폴리곤 면을 살립니다.
 *      파스텔 톤 + 낮은 해상도의 둥근 형태라 각이 공격적이지 않고, 점 눈 두 개로 표정은 최소.
 *      머리 위 따뜻한 점광 1개 + 발밑 가짜 그림자 (기존 아바타와 같은 연출).
 *      정지 = 팔을 살짝 벌리고 서서 아주 얕게 숨쉬기 / 이동 = 짧은 팔다리 스윙 + 가벼운 통통 튐.
 *
 *  · human (롤백용)
 *      이전 단계의 사람 실루엣. 화면에 버튼이 없고, 되돌릴 때만 주소에
 *      `?avatar=human` 을 붙여 봅니다. 키·형태·애니메이션은 그대로입니다.
 *
 * 전환: setMode('lowpoly' | 'human') — 기본값은 js/config.js 의 CONFIG.avatar.mode
 * 비례·색: CONFIG.avatar.lowpoly (palette 의 색, height 의 키)
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeShadowTexture } from './textures.js';

const H_REF = 1.72; // 사람 비례 기준 키(m) — human 실루엣용
const LP_BASE_H = 1.20; // 아래 lowpoly 수치를 적은 기준 키(m)

/** 주소(?avatar=)로 고를 수 있는 모드. 화면에 전환 UI 는 없습니다. */
export const AVATAR_MODES = ['lowpoly', 'human'];

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

    // lowpoly 재질 — 파스텔 + 면이 각지게(flatShading), 광택은 없앱니다
    const pal = (cfg.lowpoly && cfg.lowpoly.palette) || {};
    const surface = (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.92,
        metalness: 0,
        flatShading: true,
      });
    this.mats = {
      skin: surface(pal.skin != null ? pal.skin : 0xf1ddc7),
      shirt: surface(pal.shirt != null ? pal.shirt : 0xa7bccb),
      pants: surface(pal.pants != null ? pal.pants : 0x6f8290),
      hair: surface(pal.hair != null ? pal.hair : 0x6e5a49),
      shoe: surface(pal.shoe != null ? pal.shoe : 0x3f4750),
      eye: surface(pal.eye != null ? pal.eye : 0x3a312c),
      glint: new THREE.MeshBasicMaterial({ color: pal.glint != null ? pal.glint : 0xfdf6e8 }),
    };

    // 머리 위의 빛: 포인트 라이트 1개를 공유합니다(모드별로 세기만 조절).
    this.light = new THREE.PointLight(
      cfg.glow.lightColor,
      0,
      cfg.glow.lightDistance,
      2
    );
    this.body.add(this.light);

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

    this.forms = {}; // mode -> { group, ... }
    this.active = null;
    this.mode = null;
    this.visibleAll = true;

    this.phase = 0;
    this.amp = 0;
    this.time = 0;

    this.setMode(mode || cfg.mode || 'lowpoly');
  }

  /* ── 모드 전환 ─────────────────────────────────────────── */
  setMode(mode) {
    const next = AVATAR_MODES.indexOf(mode) >= 0 ? mode : AVATAR_MODES[0];
    if (next === this.mode) return this.mode;

    if (!this.forms[next]) {
      this.forms[next] =
        next === 'human' ? this._buildHuman() : this._buildLowpoly();
      this.body.add(this.forms[next].group);
    }
    if (this.active) this.active.group.visible = false;
    this.active = this.forms[next];
    this.active.group.visible = this.visibleAll;

    this.light.position.set(0, this.active.lightHeight, 0);
    this.light.intensity = this.active.lightIntensity || 0;
    this.shadow.scale.setScalar(this.active.shadowScale || 1);

    this.mode = next;
    this.time = 0;
    this.phase = 0;
    this.amp = 0;
    return this.mode;
  }

  /* ── 로우폴리 인체 (지금 쓰는 관람객 캐릭터) ─────────────── */
  _buildLowpoly() {
    const cfg = CONFIG.avatar;
    const lp = cfg.lowpoly || {};
    const H = lp.height || LP_BASE_H;
    const S = H / LP_BASE_H; // 아래 수치는 LP_BASE_H 기준, 키 설정에 맞춰 배율만 곱합니다
    const M = this.mats;

    const group = new THREE.Group();
    group.name = 'avatar-lowpoly';
    const spin = new THREE.Group(); // 사람은 자전하지 않습니다(형태 유지)
    group.add(spin);
    const body = spin;

    // 낮은 해상도 기본형 — 면이 보이도록 segment 를 최소로
    const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
    const sph = (r, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h);

    const addPart = (parent, geom, mat, x, y, z, scale) => {
      const m = new THREE.Mesh(geom, mat);
      m.position.set(x * S, y * S, z * S);
      if (scale) m.scale.set(scale[0] * S, scale[1] * S, scale[2] * S);
      else m.scale.setScalar(S);
      parent.add(m);
      return m;
    };

    /* 몸통 — 위아래가 둥근 달걀형(통통하게), 0.42 ~ 0.86 */
    const torso = addPart(body, sph(0.15, 7, 5), M.shirt, 0, 0.64, 0, [1, 1.42, 0.92]);

    /* 다리 — 짧고 통통하게. 골반(0.44)에서 회전 */
    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.072 * S, 0.44 * S, 0);
      body.add(pivot);
      addPart(pivot, cyl(0.058, 0.05, 0.38), M.pants, 0, -0.19, 0);
      const foot = addPart(pivot, new THREE.BoxGeometry(0.1, 0.06, 0.16), M.shoe, 0, -0.41, -0.018);
      foot.rotation.x = -0.02;
      return pivot;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    /* 골반 — 몸통 아래와 다리 사이를 메우는 짧은 반바지 */
    addPart(body, sph(0.135, 7, 4), M.pants, 0, 0.43, 0, [1, 0.56, 0.9]);

    /* 머리 — 목(0.90)에서 회전. 머리 지름 0.30 = 키의 약 1/4 */
    const head = new THREE.Group();
    head.position.y = 0.9 * S;
    body.add(head);
    addPart(head, cyl(0.05, 0.056, 0.06), M.skin, 0, -0.008, 0); // 목
    addPart(head, sph(0.152, 7, 5), M.skin, 0, 0.145, 0, [1, 1, 0.98]); // 머리 (지름 0.30)
    // 머리카락 — 머리 위쪽만 덮는 낮은 해상도의 반구
    const hair = addPart(
      head,
      new THREE.SphereGeometry(0.159, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.44),
      M.hair,
      0,
      0.145,
      0,
      [1, 1, 1]
    );
    hair.rotation.x = -0.04;
    // 점 눈 두 개 (표정은 이게 전부)
    const eyeGeo = sph(0.016, 6, 4);
    const glintGeo = sph(0.005, 5, 3);
    for (const sx of [-1, 1]) {
      addPart(head, eyeGeo, M.eye, sx * 0.045, 0.116, -0.146, [1, 1.15, 0.5]);
      addPart(head, glintGeo, M.glint, sx * 0.0495, 0.123, -0.1545, [1, 1, 0.6]);
    }

    /* 팔 — 어깨(0.80)에서 회전, 살짝 벌린 자세 */
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.145 * S, 0.75 * S, 0);
      pivot.rotation.z = side * 0.22; // 팔을 살짝 벌립니다
      body.add(pivot);
      addPart(pivot, cyl(0.036, 0.031, 0.24), M.shirt, 0, -0.12, 0);
      addPart(pivot, sph(0.038, 6, 4), M.skin, 0, -0.245, 0);
      return pivot;
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);

    return {
      group,
      spin,
      lowpoly: { body, torso, head, armL, armR, legL, legR, torsoBaseY: 1.3 * S },
      lightHeight: H + 0.34,
      lightIntensity: lp.lightIntensity != null ? lp.lightIntensity : cfg.glow.lightIntensity,
      shadowScale: H / H_REF * 0.95,
    };
  }

  /* ── 사람 실루엣 (롤백용, 이전 단계 그대로) ─────────────── */
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
      lightIntensity: 0, // 실루엣은 빛을 쓰지 않습니다
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
    this.phase += dt * (2.2 + speed * 2.4);

    if (!this.active) return;

    if (this.mode === 'human') this._updateHuman(dt, cfg);
    else this._updateLowpoly(cfg);

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

  _updateLowpoly(cfg) {
    const lp = this.active.lowpoly;
    const p = cfg.lowpoly || {};
    const swingBase = p.swing != null ? p.swing : 0.34;
    const bobBase = p.bob != null ? p.bob : 0.016;

    const a = this.amp;
    const s = Math.sin(this.phase);
    const br = Math.sin(this.time * 1.7); // 숨쉬기

    // 걷기 — 짧은 다리라 각은 조금 크게, 팔은 그 반대로 가볍게
    const swing = swingBase * a;
    lp.legL.rotation.x = s * swing;
    lp.legR.rotation.x = -s * swing;
    lp.armL.rotation.x = -s * swing * 0.8;
    lp.armR.rotation.x = s * swing * 0.8;
    lp.armL.rotation.z = -0.22 - Math.abs(s) * 0.03 * a;
    lp.armR.rotation.z = 0.22 + Math.abs(s) * 0.03 * a;

    // 통통 튀는 걸음 + 살짝 좌우로 흔들(귀여운 인상)
    const bob = Math.abs(s) * bobBase * a;
    this._bob = bob;
    this.body.position.y = bob + br * 0.0035 * (1 - a);
    this.body.rotation.z = s * 0.022 * a;
    this.body.rotation.x = -0.03 * a;

    // 서 있을 때: 아주 얕은 숨쉬기(몸통) + 머리 살짝 갸웃
    const idle = 1 - a;
    lp.torso.scale.y = lp.torsoBaseY * (1 + br * 0.012 * idle);
    lp.head.rotation.x = br * 0.03 * idle - 0.02 * a;
    lp.head.rotation.z = Math.sin(this.time * 0.8) * 0.022 * idle;
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
