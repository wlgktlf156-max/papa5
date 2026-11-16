/**
 * 전시장(홀 + 입구 공간)을 만듭니다.
 * - 홀 하나, 벽 4면(작가 1명당 1면), 입구 쪽 제목 벽과 문
 * - 조명: 환경광 1 + 스포트 3 (그림자·후처리 없음)
 * - 충돌: 축에 나란한 사각형 목록(colliders)만 사용
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import {
  makeTitlePlaque,
  makeArtistPlaque,
  makeInfoBoard,
  makeSignPlaque,
  makeFloorTexture,
  makeShadowTexture,
} from './textures.js';

export function buildHall(scene, renderer) {
  const cfg = CONFIG;
  const { hall, vestibule, door } = cfg.space;
  const H = hall.height;
  const hw = hall.width / 2;
  const hd = hall.depth / 2;
  const VH = vestibule.height;
  const vw = vestibule.width / 2;
  const vd = vestibule.depth;
  const dw = door.width / 2;
  const dh = door.height;

  const group = new THREE.Group();
  group.name = 'hall';
  scene.add(group);

  const colliders = [];
  // height: 카메라가 넘어갈 수 있는지 판단할 때 씁니다(벽은 아주 높게)
  const addCollider = (minX, maxX, minZ, maxZ, height = 99) => {
    colliders.push({ minX, maxX, minZ, maxZ, height });
  };

  /* ── 재질 ─────────────────────────────────────────────── */
  const wallMat = new THREE.MeshStandardMaterial({
    color: cfg.theme.wall,
    roughness: 0.96,
    metalness: 0,
  });
  const floorTex = makeFloorTexture(THREE, '#8d887f', renderer);
  floorTex.repeat.set(hall.width / 2, hall.depth / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.7,
    metalness: 0,
  });
  const vestFloorTex = floorTex.clone();
  vestFloorTex.needsUpdate = true;
  vestFloorTex.repeat.set(vestibule.width / 2, vd / 2);
  const vestFloorMat = new THREE.MeshStandardMaterial({
    map: vestFloorTex,
    roughness: 0.7,
    metalness: 0,
  });
  const ceilMat = new THREE.MeshStandardMaterial({
    color: cfg.theme.ceiling,
    roughness: 1,
    metalness: 0,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: cfg.theme.frame,
    roughness: 0.75,
    metalness: 0.05,
  });
  const benchMat = new THREE.MeshStandardMaterial({
    color: cfg.theme.bench,
    roughness: 0.62,
    metalness: 0,
  });
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xfff4e2 });
  const accentMat = new THREE.MeshBasicMaterial({ color: cfg.theme.accent });

  /* ── 벽 조각을 만드는 도우미 ───────────────────────────── */
  // seg: {ax,az,bx,bz,nx,nz} / offset은 벽 안쪽(+normal) 방향 거리
  function addSlab(seg, height, y, thickness, offset, material, name) {
    const mx = (seg.ax + seg.bx) / 2;
    const mz = (seg.az + seg.bz) / 2;
    const len = Math.hypot(seg.bx - seg.ax, seg.bz - seg.az);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, height, thickness), material);
    mesh.position.set(mx + seg.nx * offset, y, mz + seg.nz * offset);
    mesh.rotation.y = Math.atan2(seg.nx, seg.nz);
    if (name) mesh.name = name;
    group.add(mesh);
    return mesh;
  }

  /* ── 바닥 · 천장 ──────────────────────────────────────── */
  const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(hall.width, hall.depth), floorMat);
  hallFloor.rotation.x = -Math.PI / 2;
  hallFloor.name = 'floor-hall';
  group.add(hallFloor);

  const vestFloor = new THREE.Mesh(new THREE.PlaneGeometry(vestibule.width, vd), vestFloorMat);
  vestFloor.rotation.x = -Math.PI / 2;
  vestFloor.position.set(0, 0, hd + vd / 2);
  group.add(vestFloor);

  const hallCeil = new THREE.Mesh(new THREE.PlaneGeometry(hall.width, hall.depth), ceilMat);
  hallCeil.rotation.x = Math.PI / 2;
  hallCeil.position.y = H;
  group.add(hallCeil);

  const vestCeil = new THREE.Mesh(new THREE.PlaneGeometry(vestibule.width, vd), ceilMat);
  vestCeil.rotation.x = Math.PI / 2;
  vestCeil.position.set(0, VH, hd + vd / 2);
  group.add(vestCeil);

  /* ── 벽 ───────────────────────────────────────────────── */
  const segN = { ax: -hw, az: -hd, bx: hw, bz: -hd, nx: 0, nz: 1 };
  const segE = { ax: hw, az: -hd, bx: hw, bz: hd, nx: -1, nz: 0 };
  const segS1 = { ax: -hw, az: hd, bx: -dw, bz: hd, nx: 0, nz: -1 };
  const segS2 = { ax: dw, az: hd, bx: hw, bz: hd, nx: 0, nz: -1 };
  const segW = { ax: -hw, az: hd, bx: -hw, bz: -hd, nx: 1, nz: 0 };
  const segTitle = { ax: -vw, az: hd + vd, bx: vw, bz: hd + vd, nx: 0, nz: -1 };
  const segVL = { ax: -vw, az: hd, bx: -vw, bz: hd + vd, nx: 1, nz: 0 };
  const segVR = { ax: vw, az: hd, bx: vw, bz: hd + vd, nx: -1, nz: 0 };
  const segLintel = { ax: -dw, az: hd, bx: dw, bz: hd, nx: 0, nz: 1 };

  addSlab(segN, H, H / 2, 0.2, -0.1, wallMat, 'wall-A');
  addSlab(segE, H, H / 2, 0.2, -0.1, wallMat, 'wall-B');
  addSlab(segS1, H, H / 2, 0.2, -0.1, wallMat, 'wall-C-left');
  addSlab(segS2, H, H / 2, 0.2, -0.1, wallMat, 'wall-C-right');
  addSlab(segW, H, H / 2, 0.2, -0.1, wallMat, 'wall-D');
  addSlab(segLintel, H - dh, dh + (H - dh) / 2, 0.2, -0.1, wallMat, 'lintel');

  addSlab(segTitle, VH, VH / 2, 0.2, -0.1, wallMat, 'wall-entry');
  addSlab(segVL, VH, VH / 2, 0.2, -0.1, wallMat, 'wall-vestibule-left');
  addSlab(segVR, VH, VH / 2, 0.2, -0.1, wallMat, 'wall-vestibule-right');

  // 걸레받이
  const skirtY = 0.045;
  [segN, segE, segS1, segS2, segW].forEach((s) =>
    addSlab(s, 0.09, skirtY, 0.024, 0.012, darkMat)
  );
  addSlab(segTitle, 0.09, skirtY, 0.024, 0.012, darkMat);

  /* ── 충돌면 ───────────────────────────────────────────── */
  addCollider(-hw - 1, hw + 1, -hd - 1, -hd + 0.05); // 북
  addCollider(hw - 0.05, hw + 1, -hd - 1, hd + 1); // 동
  addCollider(-hw - 1, -hw + 0.05, -hd - 1, hd + 1); // 서
  addCollider(-hw - 1, -dw, hd - 0.05, hd + 1); // 남 좌
  addCollider(dw, hw + 1, hd - 0.05, hd + 1); // 남 우
  addCollider(-vw - 1, -vw + 0.05, hd, hd + vd + 1); // 입구 좌
  addCollider(vw - 0.05, vw + 1, hd, hd + vd + 1); // 입구 우
  addCollider(-vw - 1, vw + 1, hd + vd - 0.05, hd + vd + 1); // 제목 벽

  /* ── 조명 (환경광 1 + 스포트 3) ────────────────────────── */
  const ambient = new THREE.AmbientLight(0xffffff, 2.45);
  scene.add(ambient);

  const spotZ = [-9, 0, 9];
  spotZ.forEach((z) => {
    const spot = new THREE.SpotLight(0xfff1dc, 90, 18, 0.95, 0.9, 2);
    spot.position.set(0, H - 0.12, z);
    spot.target.position.set(0, 0, z);
    scene.add(spot);
    scene.add(spot.target);
  });

  // 천장 등기구(발광 띠) — 실제 광원이 아니라 모양용
  const stripY = H - 0.03;
  [-5.5, 5.5].forEach((x) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 17), stripMat);
    s.position.set(x, stripY, 0);
    group.add(s);
  });
  [-9, 9].forEach((z) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(8, 0.02, 0.14), stripMat);
    s.position.set(0, stripY, z);
    group.add(s);
  });
  const vStrip = new THREE.Mesh(new THREE.BoxGeometry(7, 0.02, 0.12), stripMat);
  vStrip.position.set(0, VH - 0.03, hd + vd / 2);
  group.add(vStrip);

  /* ── 입구 문 표시 ─────────────────────────────────────── */
  // 바닥 문턱
  const sill = new THREE.Mesh(new THREE.BoxGeometry(door.width, 0.012, 0.16), accentMat);
  sill.position.set(0, 0.008, hd);
  group.add(sill);

  // 입구 쪽(바깥) '입구' 표지
  const signInTex = makeSignPlaque(THREE, cfg.exhibition.entranceSign, renderer);
  const signIn = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.44),
    new THREE.MeshBasicMaterial({ map: signInTex, transparent: true })
  );
  signIn.position.set(0, dh + 0.28, hd + 0.21);
  signIn.rotation.y = 0; // +Z(입구 안쪽)을 바라봄
  group.add(signIn);

  // 홀 쪽 '출구' 표지
  const signOutTex = makeSignPlaque(THREE, cfg.exhibition.exitSign, renderer);
  const signOut = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.44),
    new THREE.MeshBasicMaterial({ map: signOutTex, transparent: true })
  );
  signOut.position.set(0, dh + 0.42, hd - 0.11);
  signOut.rotation.y = Math.PI;
  group.add(signOut);

  /* ── 입구 제목 벽 (전시 정식 명칭) ─────────────────────── */
  const boardBack = new THREE.Mesh(new THREE.BoxGeometry(7.4, 2.5, 0.06), darkMat);
  boardBack.position.set(0, 1.92, hd + vd - 0.05);
  group.add(boardBack);

  const titleTex = makeTitlePlaque(THREE, cfg, renderer);
  const titleMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(7.0, 2.19),
    new THREE.MeshBasicMaterial({ map: titleTex })
  );
  titleMesh.position.set(0, 1.92, hd + vd - 0.08);
  titleMesh.rotation.y = Math.PI;
  titleMesh.name = 'title-plaque';
  group.add(titleMesh);

  /* ── 작가 구역 라벨 ───────────────────────────────────── */
  const plaqueY = 3.26;
  const artistPlaques = [];
  const walls = [
    {
      id: 'A',
      artistId: cfg.artists[0] && cfg.artists[0].id,
      segments: [segN],
      plaque: { x: 0, z: -hd + 0.035, ry: 0 },
    },
    {
      id: 'B',
      artistId: cfg.artists[1] && cfg.artists[1].id,
      segments: [segE],
      plaque: { x: hw - 0.035, z: 0, ry: -Math.PI / 2 },
    },
    {
      id: 'C',
      artistId: cfg.artists[2] && cfg.artists[2].id,
      segments: [segS1, segS2],
      plaque: { x: (segS1.ax + segS1.bx) / 2, z: hd - 0.035, ry: Math.PI },
    },
    {
      id: 'D',
      artistId: cfg.artists[3] && cfg.artists[3].id,
      segments: [segW],
      plaque: { x: -hw + 0.035, z: 0, ry: Math.PI / 2 },
    },
  ];

  walls.forEach((wall, i) => {
    const artist = cfg.artists[i];
    if (!artist) return;
    const tex = makeArtistPlaque(THREE, artist, i, renderer);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.7, 0.59),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    mesh.position.set(wall.plaque.x, plaqueY, wall.plaque.z);
    mesh.rotation.y = wall.plaque.ry;
    group.add(mesh);
    artistPlaques.push(mesh);
  });

  /* ── 홀 안 전시 안내판 (입구 왼편, 독립 패널) ───────────── */
  const infoTex = makeInfoBoard(THREE, cfg, renderer);
  const panelW = 2.05;
  const panelH = 1.44;
  const boardZ = hd - 1.4;
  const boardX = -3.4;
  const infoBack = new THREE.Mesh(new THREE.BoxGeometry(panelW + 0.09, panelH + 0.09, 0.05), darkMat);
  infoBack.position.set(boardX, 1.35, boardZ + 0.03);
  infoBack.rotation.y = Math.PI;
  group.add(infoBack);
  const infoFace = new THREE.Mesh(
    new THREE.PlaneGeometry(panelW, panelH),
    new THREE.MeshBasicMaterial({ map: infoTex })
  );
  infoFace.position.set(boardX, 1.35, boardZ);
  infoFace.rotation.y = Math.PI;
  group.add(infoFace);
  // 다리
  [-0.7, 0.7].forEach((dx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.66, 0.05), darkMat);
    leg.position.set(boardX + dx, 0.33, boardZ + 0.03);
    group.add(leg);
  });
  addCollider(boardX - panelW / 2 - 0.12, boardX + panelW / 2 + 0.12, boardZ - 0.16, boardZ + 0.16, 2.15);

  /* ── 가운데 벤치 ──────────────────────────────────────── */
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 3.2), benchMat);
  benchTop.position.set(4.2, 0.42, 1.2);
  group.add(benchTop);
  const benchBase = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 2.5), benchMat);
  benchBase.position.set(4.2, 0.2, 1.2);
  group.add(benchBase);
  // 벤치 접지 그림자
  const benchShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: makeShadowTexture(THREE, 0.45, renderer),
      transparent: true,
      depthWrite: false,
    })
  );
  benchShadow.rotation.x = -Math.PI / 2;
  benchShadow.scale.set(1.7, 3.9, 1);
  benchShadow.position.set(4.2, 0.014, 1.2);
  group.add(benchShadow);
  addCollider(3.73, 4.67, -0.42, 2.82, 0.5);

  return { group, colliders, walls, ambient };
}
