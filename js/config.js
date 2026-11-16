/**
 * ============================================================
 *  전시 데이터 설정 파일 — 이 파일 하나만 고치면 전시가 바뀝니다.
 * ============================================================
 *  · 전시 제목/기간 : CONFIG.exhibition
 *  · 공간 크기      : CONFIG.space      (홀·입구 크기, 시작 위치)
 *  · 카메라/조작    : CONFIG.camera / CONFIG.player
 *  · 캐릭터 색·형태 : CONFIG.avatar     (mode·forms·glow. 형태는 js/avatar.js)
 *  · 색상 테마      : CONFIG.theme
 *  · 작가 4명       : CONFIG.artists    (name, line)
 *
 *  작품 목록은 이 파일이 아니라 사이트 폴더의 works.json 에 있습니다.
 *  (사진은 works/ 폴더에 넣습니다 — README 의 「작품 추가하는 법」 참고)
 * ============================================================
 */

export const CONFIG = {
  exhibition: {
    // 간판에 그대로 표기하는 정식 명칭 (띄어쓰기·괄호까지 이 문자열을 씁니다)
    title: '파티프로덕션디자인 아카데미(PaPA) 제5회 마친보람맺음전',
    titleLine1: '파티프로덕션디자인 아카데미(PaPA)',
    titleLine2: '제5회 마친보람맺음전',
    kicker: 'PaPA ANNUAL EXHIBITION',
    period: '2027. 01. 20 – 02. 28 (예정)',
    place: '온라인 3D 전시장 · 입장 무료',
    entryButton: '입장하기',
    demoNote:
      '제작 중인 빈 전시장 데모입니다. 액자 속 이미지는 모두 임시 이미지이고, 확대 보기는 다음 단계에서 연결됩니다.',
    entranceSign: '입구',
    exitSign: '출구',
  },

  space: {
    hall: { width: 22, depth: 28, height: 4.6 }, // 전시홀 (가로 x 세로 x 높이, m)
    vestibule: { width: 10, depth: 7, height: 3.4 }, // 입구 공간
    door: { width: 4.2, height: 3.0 }, // 홀과 입구를 잇는 문
    hangingHeight: 1.55, // 작품 중심 높이
    // 시작 위치: 홀 안, 입구에서 6m 들어온 지점. 바라보는 방향 0 = 홀 안쪽(-Z)
    spawn: { x: 0, z: 7.8, facing: 0, cameraYaw: 0 },
  },

  camera: {
    fov: 60,
    near: 0.05,
    far: 200,
    distance: 4.0, // 캐릭터 뒤 카메라 거리 (m)
    minDistance: 0.9, // 벽에 막혔을 때 최소 거리
    targetHeight: 1.52, // 카메라가 바라보는 높이(캐릭터 가슴)
    pitch: 0.16, // 0 = 눈높이, + = 위에서 내려다봄 (rad)
    minPitch: -0.1,
    maxPitch: 1.15,
    mouseSensitivity: 0.0032,
    touchSensitivity: 0.0042,
    followLag: 12, // 클수록 카메라가 즉시 따라붙음
    autoAlign: true, // 이동할 때 카메라가 캐릭터 뒤로 서서히 정렬
    autoAlignRate: 2.0,
    autoAlignDelay: 0.45, // 드래그 후 이 시간(초) 동안은 자동 정렬 안 함
    collisionPadding: 0.26, // 카메라와 벽 사이 여유
  },

  player: {
    radius: 0.34, // 충돌 반지름
    walkSpeed: 2.6, // m/s
    runMultiplier: 1.75, // Shift
    accel: 16, // 가속(클수록 즉각적)
    turnSpeed: 11, // 캐릭터가 이동 방향으로 도는 속도
  },

  avatar: {
    // 기본으로 세울 캐릭터: 'prism' | 'cylinder' | 'slab' | 'human'
    // (주소에 ?avatar=cylinder 처럼 붙이면 그 캐릭터로 열립니다)
    mode: 'prism',

    // 공통 색 — 사람·오브제 모두 같은 톤을 씁니다.
    color: 0x2e2e34, // 몸 색
    rimColor: 0xc9a86a, // 실루엣 테두리(림) 색 — 배경과 구분용, 아주 약하게
    rimOpacity: 0.4,
    height: 1.72, // 사람 실루엣 키(m)
    bob: 0.022, // 걸을 때 상하 흔들림
    swing: 0.62, // 사람 팔다리 스윙 각도(rad)
    shadowOpacity: 0.42, // 발밑 가짜 그림자

    // 추상 오브제 3종의 비례 (단위 m)
    //   height 높이 · width 폭 · depth 두께 · spin 자기 축 회전 속도(rad/s) · tilt 기울기(rad)
    forms: {
      prism: { height: 1.66, width: 0.42, depth: 0.26, spin: 0.2 },
      cylinder: { height: 1.62, width: 0.44, taper: 0.92, spin: 0.14 },
      slab: { height: 1.74, width: 0.6, depth: 0.07, spin: 0.26, tilt: 0.13, tiltX: 0.05 },
    },

    // 상단(머리)에서 새어 나오는 빛 — 발광 구 + 약한 포인트 라이트 1개
    glow: {
      color: 0xffe6b8, // 빛 색(구·빛 틈·후광)
      coreSize: 0.055, // 발광 구 반지름(m)
      haloSize: 0.55, // 후광 크기(m)
      haloOpacity: 0.55,
      lightColor: 0xffcf96, // 포인트 라이트 색
      lightIntensity: 0.85,
      lightDistance: 3.0, // 빛이 닿는 거리(m)
      pulse: 0.18, // 빛 떨림 정도 (0 = 고정)
    },
  },

  interaction: {
    range: 2.4, // 작품 앞 이 거리 안에 들어오면 선택 가능
    minFacingDot: 0.2, // 작품이 놓인 벽 앞쪽에 있어야 함(벽 반대편 제외)
    highlightColor: 0xc9a86a,
  },

  render: {
    maxPixelRatio: 2,
    minPixelRatio: 1,
    antialiasOnMobile: false,
  },

  theme: {
    wall: 0xe6e2da,
    floor: 0x8d887f,
    ceiling: 0xece9e3,
    frame: 0x231f1b,
    mat: 0xf6f3ec,
    bench: 0x3a342c,
    accent: 0xc9a86a,
    background: 0x0d0c0b,
    fog: 0x9c968d,
    fogNear: 34,
    fogFar: 95,
  },

  // ── 작가 4명 (벽 1면 = 작가 1명) ─────────────────────────────
  // name / line 만 바꾸면 간판에 바로 반영됩니다.
  artists: [
    {
      id: 'a',
      name: '김동현',
      line: '작가 소개 자리 — 한 줄 소개가 여기에 들어갑니다',
      palette: ['#d8c4a0', '#7c5f42', '#ece2cf'],
    },
    {
      id: 'b',
      name: '작가 B',
      line: '작가 소개 자리',
      palette: ['#9fb3c8', '#2f4858', '#dfe7ef'],
    },
    {
      id: 'c',
      name: '작가 C',
      line: '작가 소개 자리',
      palette: ['#a8b89a', '#3f5340', '#e3e8d9'],
    },
    {
      id: 'd',
      name: '작가 D',
      line: '작가 소개 자리',
      palette: ['#d5a08a', '#6d4230', '#f0dcd2'],
    },
  ],
};
