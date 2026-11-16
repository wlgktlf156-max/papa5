/**
 * 작품 목록 불러오기 — 사이트 폴더의 works.json 하나만 읽습니다.
 * ------------------------------------------------------------------
 * · 전시장 코드(config.js / artworks.js)는 이 파일이 돌려주는 목록만 보고 액자를 겁니다.
 *   그래서 작품을 추가·수정할 때는 works.json 만 고치면 됩니다.
 * · works.json 이 없거나 형식이 틀리면, 어디가 문제인지 알려주는 오류를 던집니다.
 * · 사진 파일은 여기서 찾지 않습니다(artworks.js 가 works/ 폴더에서 찾습니다).
 */

export const DATA_URL = 'works.json';

/** works/ 안에서 자동으로 찾아볼 사진 확장자 (앞에서부터 시도) */
export const IMAGE_EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png'];

/** 사진 폴더 */
export const WORKS_DIR = 'works/';

/** 사진 비율을 모를 때 쓰는 기본 크기(m) */
export const DEFAULT_SIZE = { width: 1.4, height: 1.8 };

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

/** id 가 없을 때 같은 무늬가 나오지 않도록 id 로 고정된 숫자를 만듭니다. */
function seedFromId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 9000) + 100;
}

/** JSON 오류 메시지에서 "몇 번째 줄"을 뽑아 사용자가 고칠 곳을 알려줍니다. */
function parseErrorMessage(text, err) {
  const msg = (err && err.message) || String(err);
  const m = /position (\d+)/i.exec(msg) || /at position (\d+)/i.exec(msg);
  if (m) {
    const pos = Math.min(text.length, Math.max(0, parseInt(m[1], 10)));
    const line = text.slice(0, pos).split('\n').length;
    const col = pos - text.lastIndexOf('\n', pos - 1);
    return `works.json ${line}번째 줄 ${col}번째 글자 근처의 형식이 잘못되었습니다. (${msg})`;
  }
  return `works.json 형식이 잘못되었습니다. (${msg})`;
}

/** 작품 하나를 정해진 모양으로 다듬습니다. */function normalizeWork(raw, index, usedIds, warnings, artistIds) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push(`${index + 1}번째 항목이 { } 모양이 아니어서 건너뜁니다.`);
    return null;
  }

  const artist = str(raw.artist).toLowerCase();
  if (!artist) {
    warnings.push(`${index + 1}번째 작품에 "artist" 가 없어 건너뜁니다.`);
    return null;
  }
  if (artistIds && !artistIds.includes(artist)) {
    warnings.push(
      `${index + 1}번째 작품의 artist "${artist}" 는 없는 작가입니다. (${artistIds.join(', ')} 중 하나)`
    );
    return null;
  }

  let id = str(raw.id);
  if (!id) {
    id = `${artist}${String(index + 1).padStart(2, '0')}`;
    warnings.push(`${index + 1}번째 작품에 "id" 가 없어 "${id}" 로 넣었습니다.`);
  }
  if (usedIds.has(id)) {
    const fixed = `${id}-${index + 1}`;
    warnings.push(`id "${id}" 가 두 번 나와서 두 번째는 "${fixed}" 로 넣었습니다.`);
    id = fixed;
  }
  usedIds.add(id);

  return {
    id,
    artist,
    title: str(raw.title) || '무제',
    year: str(raw.year),
    medium: str(raw.medium),
    description: str(raw.description),
    image: str(raw.image),
    width: num(raw.width),
    height: num(raw.height),
    seed: num(raw.seed) || seedFromId(id),
  };
}

/**
 * works.json 을 읽어 작품 배열을 돌려줍니다.
 * @param {{ url?: string, artistIds?: string[] }} options
 * @returns {Promise<{ works: object[], warnings: string[] }>}
 */
export async function loadWorks({ url = DATA_URL, artistIds = null } = {}) {
  let text;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      throw new Error(
        '파일을 직접 열면(file://) 작품 목록을 읽을 수 없습니다. README 의 서버 실행 방법으로 열어 주세요.'
      );
    }
    throw new Error(`작품 목록(${DATA_URL})을 불러오지 못했습니다. (${e.message})`);
  }

  const clean = text.replace(/^\uFEFF/, '');
  let data;
  try {
    data = JSON.parse(clean);
  } catch (e) {
    // 마지막 항목 뒤에 쉼표를 남긴 정도의 실수는 받아 줍니다.
    try {
      data = JSON.parse(clean.replace(/,\s*([}\]])/g, '$1'));
    } catch (e2) {
      throw new Error(parseErrorMessage(clean, e2));
    }
  }

  const list = Array.isArray(data) ? data : data && Array.isArray(data.works) ? data.works : null;
  if (!list) {
    throw new Error('works.json 안에 "works" 목록이 없습니다. { "works": [ ... ] } 모양이어야 합니다.');
  }

  const warnings = [];
  const usedIds = new Set();
  const works = [];
  list.forEach((raw, i) => {
    const w = normalizeWork(raw, i, usedIds, warnings, artistIds);
    if (w) works.push(w);
  });

  if (warnings.length) console.warn('[전시] works.json 확인이 필요합니다:\n- ' + warnings.join('\n- '));

  return { works, warnings };
}
