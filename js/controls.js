/**
 * 3인칭 조작
 *  · PC : W A S D / 화살표 이동, Shift 빠르게, 마우스 드래그로 시점, E 로 작품 선택
 *  · 모바일 : 왼쪽 조이스틱 이동, 오른쪽 드래그 시점
 *  · 캐릭터는 이동 방향으로 회전, 카메라는 뒤에서 부드럽게 따라오며 벽을 뚫지 않음
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export class ThirdPersonControls {
  constructor(camera, dom, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.cfg = CONFIG.camera;
    this.pcfg = CONFIG.player;
    this.colliders = opts.colliders || [];
    this.onTap = opts.onTap || null;
    this.onInteract = opts.onInteract || null;

    const sp = CONFIG.space.spawn;
    this.pos = new THREE.Vector2(sp.x, sp.z); // x, z
    this.vel = new THREE.Vector2();
    this.yaw = sp.facing || 0;
    this.camYaw = sp.cameraYaw || 0;
    this.camPitch = this.cfg.pitch;
    this.lookAt = new THREE.Vector3(sp.x, this.cfg.targetHeight, sp.z);

    this.enabled = false;
    this.keys = new Set();
    this.stick = { x: 0, y: 0, active: false };
    this.speed = 0;
    this.moving = false;
    this.dist = this.cfg.distance;
    this.dragId = null;
    this.lastDragTime = -10;
    this.time = 0;

    this._tmpTarget = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
    this._tmpCam = new THREE.Vector3();

    this._bind();
  }

  _bind() {
    this._onKeyDown = (e) => {
      if (!this.enabled && e.code !== 'Escape') return;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(
          e.code
        )
      ) {
        // 페이지 스크롤 방지
        if (e.target === document.body || e.target === this.dom) e.preventDefault();
      }
      this.keys.add(e.code);
      if (e.code === 'KeyE' && this.onInteract) this.onInteract();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => this.keys.clear();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

    this._onDown = (e) => {
      if (!this.enabled) return;
      if (this.joyEl && this.joyEl.contains(e.target)) return;
      this.dragId = e.pointerId;
      this.dragMoved = 0;
      this.dragStart = performance.now();
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dom.classList.add('dragging');
      try {
        this.dom.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 무시 */
      }
    };
    this._onMove = (e) => {
      if (e.pointerId !== this.dragId) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      const sens =
        e.pointerType === 'touch' ? this.cfg.touchSensitivity : this.cfg.mouseSensitivity;
      this.camYaw -= dx * sens;
      this.camPitch = clamp(this.camPitch + dy * sens, this.cfg.minPitch, this.cfg.maxPitch);
      this.lastDragTime = this.time;
    };
    this._onUp = (e) => {
      if (e.pointerId !== this.dragId) return;
      const quick = performance.now() - this.dragStart < 500 && this.dragMoved < 9;
      this.dragId = null;
      this.dom.classList.remove('dragging');
      if (quick && this.onTap) this.onTap(e.clientX, e.clientY);
    };

    this.dom.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  }

  /** 조이스틱 요소 연결 (모바일) */
  attachJoystick(el) {
    this.joyEl = el;
    const knob = el.querySelector('.stick');
    const reset = () => {
      this.joyId = null;
      this.stick.x = 0;
      this.stick.y = 0;
      this.stick.active = false;
      el.classList.remove('active');
      if (knob) knob.style.transform = 'translate(0px, 0px)';
    };
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const maxR = r.width / 2 - 18;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > maxR) {
        dx = (dx / len) * maxR;
        dy = (dy / len) * maxR;
      }
      this.stick.x = dx / maxR;
      this.stick.y = -dy / maxR;
      if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.joyId = e.pointerId;
      this.stick.active = true;
      el.classList.add('active');
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 무시 */
      }
      move(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyId) return;
      e.preventDefault();
      move(e);
    });
    const end = (e) => {
      if (this.joyId === null || e.pointerId !== this.joyId) return;
      reset();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // 조이스틱 밖에서 손을 떼도 확실히 멈추도록 전역에서도 받습니다.
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
  }

  setEnabled(v) {
    this.enabled = v;
    if (v) this.snapCamera();
  }

  /* ── 이동 ─────────────────────────────────────────────── */
  update(dt) {
    this.time += dt;
    if (!this.enabled) {
      this.speed = 0;
      this.moving = false;
      return;
    }

    let f = 0;
    let s = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) s += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
    f += this.stick.y;
    s += this.stick.x;

    const mag = Math.hypot(f, s);
    if (mag > 1) {
      f /= mag;
      s /= mag;
    }

    // 카메라 기준 방향
    const fx = -Math.sin(this.camYaw);
    const fz = -Math.cos(this.camYaw);
    const rx = Math.cos(this.camYaw);
    const rz = -Math.sin(this.camYaw);

    const dirX = fx * f + rx * s;
    const dirZ = fz * f + rz * s;

    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const maxSpeed = this.pcfg.walkSpeed * (run ? this.pcfg.runMultiplier : 1);
    const kk = 1 - Math.exp(-this.pcfg.accel * dt);
    this.vel.x += (dirX * maxSpeed - this.vel.x) * kk;
    this.vel.y += (dirZ * maxSpeed - this.vel.y) * kk;

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.resolveCollisions();

    this.speed = this.vel.length();
    this.moving = this.speed > 0.12;

    // 이동 방향으로 회전
    if (Math.hypot(dirX, dirZ) > 0.08) {
      const targetYaw = Math.atan2(-dirX, -dirZ);
      this.yaw = lerpAngle(this.yaw, targetYaw, 1 - Math.exp(-this.pcfg.turnSpeed * dt));
    }

    // 카메라 자동 정렬 (앞으로 걸을 때만, 드래그 직후엔 안 함)
    if (
      this.cfg.autoAlign &&
      this.moving &&
      f > 0.1 &&
      Math.abs(s) < 0.5 &&
      this.time - this.lastDragTime > this.cfg.autoAlignDelay
    ) {
      this.camYaw = lerpAngle(this.camYaw, this.yaw, 1 - Math.exp(-this.cfg.autoAlignRate * dt));
    }

    this.updateCamera(dt);
  }

  resolveCollisions() {
    const r = this.pcfg.radius;
    for (let it = 0; it < 4; it++) {
      let hit = false;
      for (const c of this.colliders) {
        const minX = c.minX - r;
        const maxX = c.maxX + r;
        const minZ = c.minZ - r;
        const maxZ = c.maxZ + r;
        if (this.pos.x > minX && this.pos.x < maxX && this.pos.y > minZ && this.pos.y < maxZ) {
          const dl = this.pos.x - minX;
          const dr = maxX - this.pos.x;
          const du = this.pos.y - minZ;
          const dd = maxZ - this.pos.y;
          const m = Math.min(dl, dr, du, dd);
          if (m === dl) this.pos.x = minX;
          else if (m === dr) this.pos.x = maxX;
          else if (m === du) this.pos.y = minZ;
          else this.pos.y = maxZ;
          hit = true;
        }
      }
      if (!hit) break;
    }
  }

  /* ── 카메라 ───────────────────────────────────────────── */
  ceilingAt(z) {
    const { hall, vestibule } = CONFIG.space;
    return z > hall.depth / 2 ? vestibule.height : hall.height;
  }

  isBlocked(x, z, y) {
    const pad = this.cfg.collisionPadding;
    for (const c of this.colliders) {
      if (y > (c.height || 99)) continue;
      if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) {
        return true;
      }
    }
    return false;
  }

  cameraTarget(out) {
    return out.set(this.pos.x, this.cfg.targetHeight, this.pos.y);
  }

  /** 화면 비율에 따른 기본 카메라 거리 (세로 화면은 좀 더 멀리) */
  baseDistance() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    return this.cfg.distance * (aspect < 0.9 ? 1.4 : 1);
  }

  updateCamera(dt) {
    const target = this.cameraTarget(this._tmpTarget);
    const cp = Math.cos(this.camPitch);
    const dir = this._tmpDir.set(
      Math.sin(this.camYaw) * cp,
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * cp
    );

    // 벽·천장에 막히면 카메라를 앞으로 당김
    const base = this.baseDistance();
    let dist = base;
    for (let d = 0.45; d <= base; d += 0.14) {
      const px = target.x + dir.x * d;
      const pz = target.z + dir.z * d;
      const py = target.y + dir.y * d;
      const ceil = this.ceilingAt(pz);
      if (py > ceil - 0.2 || py < 0.35 || this.isBlocked(px, pz, py)) {
        dist = Math.max(this.cfg.minDistance, d - 0.16);
        break;
      }
    }
    this.dist = dist;

    const desired = this._tmpCam.copy(target).addScaledVector(dir, dist);
    desired.y = clamp(desired.y, 0.4, this.ceilingAt(desired.z) - 0.16);

    const lag = 1 - Math.exp(-this.cfg.followLag * dt);
    this.camera.position.lerp(desired, lag);
    this.lookAt.lerp(target, 1 - Math.exp(-18 * dt));
    this.camera.lookAt(this.lookAt);
  }

  snapCamera() {
    const target = this.cameraTarget(this._tmpTarget);
    const cp = Math.cos(this.camPitch);
    const dir = this._tmpDir.set(
      Math.sin(this.camYaw) * cp,
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * cp
    );
    const d = this.baseDistance();
    this.camera.position.copy(target).addScaledVector(dir, d);
    this.lookAt.copy(target);
    this.camera.lookAt(this.lookAt);
    this.dist = d;
  }

  getState() {
    return {
      x: +this.pos.x.toFixed(2),
      z: +this.pos.y.toFixed(2),
      yaw: +this.yaw.toFixed(2),
      camYaw: +this.camYaw.toFixed(2),
      camPitch: +this.camPitch.toFixed(2),
      speed: +this.speed.toFixed(2),
      dist: +this.dist.toFixed(2),
      camera: this.camera.position.toArray().map((v) => +v.toFixed(2)),
    };
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.dom.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
  }
}
