/**
 * 액자·작품 배치.
 * - works.json 에서 읽은 작품 목록을 벽에 고르게 배치합니다(작품 수가 늘거나 줄어도 유지).
 * - works.json 의 image 에 적힌 사진을 걸고, 사진이 없거나 깨졌으면 임시 이미지를 그립니다.
 * - 근접 감지/하이라이트를 위해 작품마다 pickable 정보를 돌려줍니다.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeArtworkTexture } from './textures.js';
import { IMAGE_EXTENSIONS, WORKS_DIR, DEFAULT_SIZE } from './works-data.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/* ── 사진 찾기 ────────────────────────────────────────────── */

// 같은 파일을 두 번 받지 않도록 기억 (성공 = 이미지, 실패 = null)
const imageCache = new Map();
// works.json 에 적힌 사진이 실제로 없을 때 알려 주기 위한 목록
const missingImages = [];

function loadImageElement(url) {
  if (imageCache.has(url)) return Promise.resolve(imageCache.get(url));
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(url, null);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * 작품 사진을 찾습니다.
 * · image 에 파일 이름이 적혀 있으면 그 파일만 요청합니다 (없으면 조용히 임시 이미지).
 * · image 가 "auto" 이면 works/<id>.webp → .jpg → .jpeg → .png 순서로 찾아봅니다.
 * · image 가 비어 있으면 사진 없이 임시 이미지를 그립니다 (없는 파일을 요청하지 않음).
 * 못 찾으면 null. 오류를 던지지 않습니다.
 */
async function findWorkImage(work) {
  const explicit = String(work.image || '').trim();
  if (!explicit) return null;

  if (explicit.toLowerCase() === 'auto') {
    for (const ext of IMAGE_EXTENSIONS) {
      const img = await loadImageElement(`${WORKS_DIR}${work.id}.${ext}`);
      if (img) return img;
    }
    missingImages.push(`${WORKS_DIR}${work.id}.* (${work.id})`);
    return null;
  }

  const url =
    /^(https?:|data:|blob:|\/)/.test(explicit) || explicit.includes('/')
      ? explicit
      : WORKS_DIR + explicit;
  const img = await loadImageElement(url);
  if (!img) missingImages.push(`${url} (${work.id})`);
  return img;
}

function imageTexture(img, renderer) {
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  tex.needsUpdate = true;
  return tex;
}

/* ── 액자 크기 정하기 ─────────────────────────────────────── */

/** works.json 의 width/height(m) 또는 사진 비율로 액자 크기를 정합니다. */
function workSize(work, aspectFromImage) {
  const aspect =
    aspectFromImage && isFinite(aspectFromImage) && aspectFromImage > 0.05 && aspectFromImage < 20
      ? aspectFromImage
      : null;
  const fallbackAspect = DEFAULT_SIZE.width / DEFAULT_SIZE.height;

  let w = work.width;
  let h = work.height;
  if (w && h) {
    // 둘 다 적혀 있으면 그대로
  } else if (h && !w) {
    w = h * (aspect || fallbackAspect);
  } else if (w && !h) {
    h = w / (aspect || fallbackAspect);
  } else if (aspect) {
    h = 1.5;
    w = h * aspect;
  } else {
    w = DEFAULT_SIZE.width;
    h = DEFAULT_SIZE.height;
  }

  return { w: clamp(w, 0.25, 6), h: clamp(h, 0.25, 5.5) };
}

/* ── 액자 만들기 ──────────────────────────────────────────── */

export async function buildArtworks(scene, walls, renderer, works = [], onProgress) {
  const cfg = CONFIG;
  const group = new THREE.Group();
  group.name = 'artworks';
  scene.add(group);

  const pickables = [];
  const frameBaseMat = new THREE.MeshStandardMaterial({
    color: cfg.theme.frame,
    roughness: 0.6,
    metalness: 0.08,
  });
  const matMat = new THREE.MeshStandardMaterial({
    color: cfg.theme.mat,
    roughness: 0.95,
    metalness: 0,
  });

  const total = Math.max(1, works.length);
  const hallHeight = cfg.space.hall.height;
  let done = 0;

  for (const wall of walls) {
    const artist = cfg.artists.find((a) => a.id === wall.artistId);
    if (!artist) continue;
    const wallWorks = works.filter((w) => w.artist === wall.artistId);
    const segments = wall.segments || [];
    if (!wallWorks.length || !segments.length) continue;

    const perSeg = Math.ceil(wallWorks.length / segments.length);

    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      const segWorks = wallWorks.slice(s * perSeg, (s + 1) * perSeg);
      if (!segWorks.length) continue;

      /* 1) 사진과 크기를 먼저 준비 (사진 비율로 액자 크기를 정할 수 있게) */
      const items = [];
      for (const work of segWorks) {
        await nextFrame();
        const img = await findWorkImage(work);
        const aspect = img && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null;
        const size = workSize(work, aspect);
        const tex = img
          ? imageTexture(img, renderer)
          : makeArtworkTexture(THREE, { ...work, width: size.w, height: size.h }, artist.palette, renderer);
        items.push({ work, w: size.w, h: size.h, tex });
      }

      /* 2) 벽 한 조각에 고르게 늘어놓기 (넘치면 간격을 좁히고, 그래도 넘치면 비율대로 줄임) */
      const L = Math.hypot(seg.bx - seg.ax, seg.bz - seg.az);
      const dirX = (seg.bx - seg.ax) / L;
      const dirZ = (seg.bz - seg.az) / L;
      const margin = L > 12 ? 2.2 : 1.2;
      const usable = Math.max(1, L - margin * 2);

      const n = items.length;
      const totalW = items.reduce((sum, it) => sum + it.w, 0);
      let gap = n > 1 ? clamp((usable - totalW) / (n - 1), 1.0, 3.4) : 0;
      let span = totalW + gap * (n - 1);
      let scale = 1;

      if (span > usable) {
        gap = n > 1 ? 0.45 : 0;
        span = totalW + gap * (n - 1);
        if (span > usable) scale = usable / span;
      }

      // 벽 높이를 넘는 작품이 있으면 전체를 더 줄여 천장/바닥을 뚫지 않게
      const maxH = hallHeight - 0.95;
      const tallest = Math.max(...items.map((it) => it.h));
      if (tallest * scale > maxH) scale = Math.min(scale, maxH / tallest);

      const ry = Math.atan2(seg.nx, seg.nz);
      let cursor = (L - span * scale) / 2;

      for (const it of items) {
        const w = it.w * scale;
        const h = it.h * scale;
        const along = cursor + w / 2;
        cursor += w + gap * scale;

        const px = seg.ax + dirX * along;
        const pz = seg.az + dirZ * along;
        // 보통은 정해진 높이(1.55m)에 걸고, 아주 큰 작품만 바닥에 닿지 않게 올립니다.
        const py = Math.max(cfg.space.hangingHeight, h / 2 + 0.45);

        const frameMat = frameBaseMat.clone();
        frameMat.emissive = new THREE.Color(0x000000);
        frameMat.emissiveIntensity = 1;

        const g = new THREE.Group();
        g.position.set(px, py, pz);
        g.rotation.y = ry;

        const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.05), frameMat);
        frameMesh.position.z = 0.025;
        g.add(frameMesh);

        const matMesh = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.05, h + 0.05), matMat);
        matMesh.position.z = 0.052;
        g.add(matMesh);

        const artMat = new THREE.MeshBasicMaterial({ map: it.tex });
        const artMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
        artMesh.position.z = 0.06;
        artMesh.name = 'artwork';
        g.add(artMesh);

        group.add(g);

        pickables.push({
          mesh: artMesh,
          frameMat,
          work: it.work,
          artist,
          position: new THREE.Vector3(px, py, pz),
          normal: new THREE.Vector3(seg.nx, 0, seg.nz),
          anchorY: py + h / 2 + 0.24,
          highlighted: false,
        });

        done++;
        if (onProgress) onProgress(done / total);
      }
    }
  }

  if (!done && onProgress) onProgress(1); // 작품이 0점이어도 로딩이 멈추지 않게

  if (missingImages.length) {
    console.warn(
      '[전시] works.json 에 적힌 사진을 찾지 못해 임시 이미지로 대체했습니다:\n- ' +
        missingImages.join('\n- ')
    );
  }

  return { group, pickables };
}

/** 하이라이트 켜기/끄기 */
export function setHighlight(pickable, on) {
  if (pickable.highlighted === on) return;
  pickable.highlighted = on;
  pickable.frameMat.emissive.setHex(on ? CONFIG.interaction.highlightColor : 0x000000);
  pickable.frameMat.emissiveIntensity = on ? 1.1 : 0;
  pickable.mesh.scale.setScalar(on ? 1.012 : 1);
}
