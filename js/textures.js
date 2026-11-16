/**
 * 캔버스로 만드는 모든 그림(간판·라벨·임시 작품 이미지·그림자).
 * 한글은 3D 글자가 아니라 전부 캔버스 텍스처로 그립니다.
 * 폰트는 시스템 폰트 스택을 쓰고, 없으면 브라우저 기본 글꼴로 떨어집니다(폴백).
 */

export const FONT_SANS =
  "'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',system-ui,-apple-system,'Segoe UI',sans-serif";
export const FONT_SERIF =
  "'AppleMyungjo','NanumMyeongjo','Nanum Myeongjo','Noto Serif KR','Batang',Georgia,'Times New Roman',serif";

export const FONT_STACKS = [FONT_SERIF, FONT_SANS];

/** 결정적 난수 (같은 seed = 같은 그림) */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 캔버스 → three 텍스처 */
export function canvasTexture(THREE, w, h, draw, renderer) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  tex.needsUpdate = true;
  return tex;
}

function setLetterSpacing(ctx, value) {
  try {
    ctx.letterSpacing = value;
  } catch (e) {
    /* 지원하지 않는 브라우저는 무시 */
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ────────────────────────────────────────────────────────────
 *  입구 제목 간판 (전시 정식 명칭)
 * ──────────────────────────────────────────────────────────── */
export function makeTitlePlaque(THREE, cfg, renderer) {
  const ex = cfg.exhibition;
  const artistNames = cfg.artists.map((a) => a.name).join('  ·  ');
  return canvasTexture(
    THREE,
    2048,
    640,
    (ctx, W, H) => {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#141310');
      g.addColorStop(1, '#0b0a09');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // 금색 얇은 테두리
      ctx.strokeStyle = 'rgba(201,168,106,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(28, 28, W - 56, H - 56);

      ctx.textAlign = 'center';

      // 윗줄: 주최/아카데미 이름
      setLetterSpacing(ctx, '10px');
      ctx.fillStyle = 'rgba(201,168,106,0.95)';
      ctx.font = `600 52px ${FONT_SANS}`;
      ctx.fillText(ex.titleLine1, W / 2, 168);

      // 아랫줄: 전시 회차 + 이름
      setLetterSpacing(ctx, '6px');
      ctx.fillStyle = '#f4efe6';
      ctx.font = `700 122px ${FONT_SERIF}`;
      ctx.fillText(ex.titleLine2, W / 2, 330);

      // 구분선
      ctx.strokeStyle = 'rgba(244,239,230,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 420, 392);
      ctx.lineTo(W / 2 + 420, 392);
      ctx.stroke();

      setLetterSpacing(ctx, '3px');
      ctx.fillStyle = 'rgba(244,239,230,0.86)';
      ctx.font = `400 44px ${FONT_SANS}`;
      ctx.fillText(ex.period, W / 2, 462);

      ctx.fillStyle = 'rgba(244,239,230,0.55)';
      ctx.font = `400 34px ${FONT_SANS}`;
      ctx.fillText(ex.place, W / 2, 516);

      ctx.fillStyle = 'rgba(201,168,106,0.8)';
      ctx.font = `400 30px ${FONT_SANS}`;
      ctx.fillText(artistNames, W / 2, 566);
    },
    renderer
  );
}

/* ────────────────────────────────────────────────────────────
 *  작가 구역 라벨
 * ──────────────────────────────────────────────────────────── */
export function makeArtistPlaque(THREE, artist, index, renderer) {
  return canvasTexture(
    THREE,
    1024,
    224,
    (ctx, W, H) => {
      ctx.fillStyle = '#f3efe6';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#12110f';
      ctx.fillRect(0, 0, 10, H);

      ctx.textAlign = 'left';
      setLetterSpacing(ctx, '6px');
      ctx.fillStyle = 'rgba(120,104,74,0.95)';
      ctx.font = `600 26px ${FONT_SANS}`;
      ctx.fillText(`ARTIST 0${index + 1}`, 56, 72);

      setLetterSpacing(ctx, '1px');
      ctx.fillStyle = '#14130f';
      ctx.font = `700 68px ${FONT_SERIF}`;
      ctx.fillText(artist.name, 54, 150);

      ctx.fillStyle = 'rgba(20,19,15,0.62)';
      ctx.font = `400 28px ${FONT_SANS}`;
      ctx.fillText(artist.line || '', 56, 196);
    },
    renderer
  );
}

/* ────────────────────────────────────────────────────────────
 *  작은 표지판 (입구 / 출구)
 * ──────────────────────────────────────────────────────────── */
export function makeSignPlaque(THREE, text, renderer) {
  return canvasTexture(
    THREE,
    512,
    160,
    (ctx, W, H) => {
      ctx.fillStyle = '#16150f';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(201,168,106,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, W - 20, H - 20);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      setLetterSpacing(ctx, '12px');
      ctx.fillStyle = '#e7dcc4';
      ctx.font = `500 62px ${FONT_SANS}`;
      ctx.fillText(text, W / 2, H / 2 + 4);
    },
    renderer
  );
}

/* ────────────────────────────────────────────────────────────
 *  홀 안의 전시 안내판
 * ──────────────────────────────────────────────────────────── */
export function makeInfoBoard(THREE, cfg, renderer) {
  const ex = cfg.exhibition;
  const names = cfg.artists.map((a) => a.name).join('  ·  ');
  return canvasTexture(
    THREE,
    1024,
    720,
    (ctx, W, H) => {
      ctx.fillStyle = '#f5f1e8';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'left';
      setLetterSpacing(ctx, '8px');
      ctx.fillStyle = 'rgba(120,104,74,0.95)';
      ctx.font = `600 26px ${FONT_SANS}`;
      ctx.fillText('EXHIBITION', 64, 92);

      setLetterSpacing(ctx, '0.5px');
      ctx.fillStyle = '#14130f';
      ctx.font = `600 42px ${FONT_SERIF}`;
      ctx.fillText(ex.titleLine1, 62, 158, 900);

      ctx.font = `700 58px ${FONT_SERIF}`;
      ctx.fillText(ex.titleLine2, 62, 226, 900);

      ctx.strokeStyle = 'rgba(20,19,15,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(64, 262);
      ctx.lineTo(W - 64, 262);
      ctx.stroke();

      ctx.fillStyle = 'rgba(20,19,15,0.8)';
      ctx.font = `400 30px ${FONT_SANS}`;
      ctx.fillText(ex.period, 64, 312);
      ctx.fillText(ex.place, 64, 354);

      ctx.fillStyle = 'rgba(20,19,15,0.5)';
      ctx.font = `500 25px ${FONT_SANS}`;
      ctx.fillText(names, 64, 404, 900);

      ctx.fillStyle = 'rgba(20,19,15,0.42)';
      ctx.font = `400 25px ${FONT_SANS}`;
      ctx.fillText('작품 가까이 가면 액자가 빛나고,', 64, 500);
      ctx.fillText('E 키나 「작품 보기」로 선택할 수 있습니다.', 64, 540);
      ctx.fillText('작품 확대 감상은 다음 단계에서 연결됩니다.', 64, 580);
    },
    renderer
  );
}

/* ────────────────────────────────────────────────────────────
 *  임시 작품 이미지 (단색 그라데이션 + 도형)
 * ──────────────────────────────────────────────────────────── */
export function makeArtworkTexture(THREE, work, palette, renderer) {
  const baseW = 512;
  const ratio = work.height / work.width;
  const w = baseW;
  const h = Math.max(180, Math.round(baseW * ratio));
  const rnd = mulberry32((work.seed || 1) * 7919 + 13);

  return canvasTexture(
    THREE,
    w,
    h,
    (ctx) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, palette[0]);
      g.addColorStop(0.55, palette[2] || palette[0]);
      g.addColorStop(1, palette[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 추상 도형 몇 개
      const count = 3 + Math.floor(rnd() * 4);
      for (let i = 0; i < count; i++) {
        ctx.globalAlpha = 0.12 + rnd() * 0.3;
        ctx.fillStyle = rnd() > 0.5 ? palette[1] : palette[2] || palette[0];
        const cx = rnd() * w;
        const cy = rnd() * h;
        const rw = w * (0.15 + rnd() * 0.5);
        const rh = h * (0.1 + rnd() * 0.45);
        if (rnd() > 0.45) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, rw * 0.5, rh * 0.5, rnd() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(cx - rw / 2, cy - rh / 2, rw, rh);
        }
      }
      ctx.globalAlpha = 1;

      // 미세한 입자
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
      }

      // 임시 이미지 표시
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      setLetterSpacing(ctx, '4px');
      ctx.font = `500 15px ${FONT_SANS}`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('임시 이미지 · PLACEHOLDER', w / 2, h - 18);
    },
    renderer
  );
}

/* ────────────────────────────────────────────────────────────
 *  캐릭터 발밑 가짜 그림자
 * ──────────────────────────────────────────────────────────── */
export function makeShadowTexture(THREE, opacity, renderer) {
  return canvasTexture(
    THREE,
    256,
    256,
    (ctx, W, H) => {
      const g = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W / 2);
      g.addColorStop(0, `rgba(0,0,0,${opacity})`);
      g.addColorStop(0.55, `rgba(0,0,0,${opacity * 0.5})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
    renderer
  );
}

/** 바닥 콘크리트 텍스처 (얇은 이음선 + 입자) */
export function makeFloorTexture(THREE, base, renderer) {
  const tex = canvasTexture(
    THREE,
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry32(2027);
      for (let i = 0; i < 3000; i++) {
        const a = (rnd() - 0.5) * 0.07;
        ctx.fillStyle =
          a > 0 ? `rgba(255,255,255,${a.toFixed(3)})` : `rgba(0,0,0,${(-a).toFixed(3)})`;
        const s = rnd() > 0.8 ? 2.5 : 1.5;
        ctx.fillRect(rnd() * W, rnd() * H, s, s);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.14)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(0.8, 0.8, W - 1.6, H - 1.6);
    },
    renderer
  );
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 화면용 간단한 원형 텍스처(작품 하이라이트 후광) */
export function makeGlowTexture(THREE, color, renderer) {
  return canvasTexture(
    THREE,
    256,
    256,
    (ctx, W, H) => {
      const g = ctx.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, W / 2);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
    renderer
  );
}
