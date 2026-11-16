/**
 * 관람객 캐릭터 — 사람 실루엣(머리·어깨·몸통·팔·다리)을 코드로만 만든 저폴리 모델.
 * 외부 모델 파일(GLB) 없음. 리깅 없이 팔다리 회전 + 상하 흔들림으로 걷기를 표현합니다.
 * 얼굴·옷 디테일은 넣지 않고 실루엣만 유지합니다.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeShadowTexture } from './textures.js';

const H_REF = 1.72; // 비례 기준 키(m)

export class Avatar {
  constructor(scene, renderer) {
    const cfg = CONFIG.avatar;
    const S = (cfg.height || H_REF) / H_REF;

    this.root = new THREE.Group();
    this.root.name = 'avatar';
    this.root.position.set(CONFIG.space.spawn.x, 0, CONFIG.space.spawn.z);
    this.root.rotation.y = CONFIG.space.spawn.facing || 0;
    scene.add(this.root);

    this.body = new THREE.Group();
    this.root.add(this.body);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      roughness: 0.9,
      metalness: 0,
      emissive: 0x0a0a0c,
      emissiveIntensity: 1,
    });
    // 아주 약한 림: 몸을 아주 살짝 키운 뒷면만 그려 실루엣 테두리처럼 보이게
    const rimMat = new THREE.MeshBasicMaterial({
      color: cfg.rimColor,
      side: THREE.BackSide,
      transparent: true,
      opacity: cfg.rimOpacity,
      depthWrite: false,
    });

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
    addPart(this.body, cyl(0.148, 0.112, 0.46), 0, 1.26, 0); // 가슴
    addPart(this.body, cyl(0.12, 0.104, 0.2), 0, 0.97, 0); // 허리~골반
    addPart(this.body, sph(0.062, 10, 8), -0.176, 1.448, 0); // 어깨
    addPart(this.body, sph(0.062, 10, 8), 0.176, 1.448, 0);

    /* 목 · 머리 */
    addPart(this.body, cyl(0.042, 0.05, 0.09, 10), 0, 1.505, 0);
    addPart(this.body, sph(0.092, 16, 12), 0, 1.605, 0, [1, 1.07, 1.02]);

    /* 팔 (어깨 피벗에서 회전) */
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.188 * S, 1.435 * S, 0);
      this.body.add(pivot);
      addPart(pivot, cyl(0.045, 0.039, 0.6, 10), 0, -0.3, 0, null, false);
      addPart(pivot, sph(0.047, 10, 8), 0, -0.618, 0, null, false);
      return pivot;
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    /* 다리 (골반 피벗에서 회전) */
    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.083 * S, 0.88 * S, 0);
      this.body.add(pivot);
      addPart(pivot, cyl(0.058, 0.046, 0.82, 10), 0, -0.41, 0);
      const foot = addPart(
        pivot,
        new THREE.BoxGeometry(0.085, 0.052, 0.2),
        0,
        -0.845,
        -0.045
      );
      foot.rotation.x = -0.04;
      return pivot;
    };
    this.legL = makeLeg(-1);
    this.legR = makeLeg(1);

    /* 발밑 가짜 그림자 */
    const shadowTex = makeShadowTexture(THREE, cfg.shadowOpacity || 0.4, renderer);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.root.add(this.shadow);

    this.phase = 0;
    this.amp = 0;
    this.time = 0;
  }

  /** dt: 초, speed: 현재 이동 속도(m/s) */
  update(dt, speed) {
    const cfg = CONFIG.avatar;
    this.time += dt;

    const target = Math.min(1, speed / Math.max(0.1, CONFIG.player.walkSpeed));
    this.amp += (target - this.amp) * Math.min(1, dt * 9);
    this.phase += dt * (2.2 + speed * 2.1);

    const swing = cfg.swing * this.amp;
    const s = Math.sin(this.phase);

    this.legL.rotation.x = s * swing;
    this.legR.rotation.x = -s * swing;
    this.armL.rotation.x = -s * swing * 0.75;
    this.armR.rotation.x = s * swing * 0.75;
    this.armL.rotation.z = 0.09;
    this.armR.rotation.z = -0.09;

    const bob = Math.abs(Math.sin(this.phase)) * cfg.bob * this.amp;
    const breathe = Math.sin(this.time * 1.6) * 0.006 * (1 - this.amp);
    this.body.position.y = bob + breathe;
    this.body.rotation.z = Math.sin(this.phase) * 0.012 * this.amp;
    this.body.rotation.x = -0.045 * this.amp;

    this.shadow.scale.setScalar(1 + bob * 1.2);
  }

  setPosition(x, z) {
    this.root.position.x = x;
    this.root.position.z = z;
  }

  setVisible(v) {
    this.body.visible = v;
    this.shadow.visible = v;
  }
}
