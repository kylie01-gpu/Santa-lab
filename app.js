// 산타 홀로그램 엽서 AR — 메인 코드
// MindAR(이미지 인식) + three.js(홀로그램 렌더링)

import * as THREE from 'three';
import { CONFIG } from './config.js';

const H = CONFIG.hologram;
const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

const PREVIEW = CONFIG.forcePreview || location.hash === '#preview';

// ------------------------------------------------------------
//  UI 준비
// ------------------------------------------------------------
$('cardThumb').style.backgroundImage = `url("${CONFIG.postcardImage}")`;
$('storeBtn').href = CONFIG.storeUrl;
$('storeBtn').textContent = CONFIG.storeButtonText;

const IN_APP = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|everytimeApp|DaumApps/i.test(navigator.userAgent);
if (IN_APP && !PREVIEW) show('inapp');

function showError(title, text) {
  hide('loading'); hide('hint'); hide('start');
  $('errorTitle').textContent = title;
  $('errorText').textContent = text;
  show('error');
}

// ------------------------------------------------------------
//  영상 엘리먼트
// ------------------------------------------------------------
const video = document.createElement('video');
video.setAttribute('playsinline', '');
video.setAttribute('webkit-playsinline', '');
video.playsInline = true;
video.preload = 'auto';
video.crossOrigin = 'anonymous';
Object.assign(video.style, {
  position: 'fixed', left: '0', top: '0', width: '2px', height: '2px',
  opacity: '0', pointerEvents: 'none', zIndex: '-1',
});
document.body.appendChild(video);

let videoAspect = 9 / 16;

async function loadVideoSource() {
  if (PREVIEW) {
    // 미리보기(아티팩트 등)에서는 blob 으로 불러와야 안전해요
    try {
      const res = await fetch(CONFIG.videoSrc);
      if (!res.ok) throw new Error(res.status);
      video.src = URL.createObjectURL(await res.blob());
      return;
    } catch (e) { /* 실패하면 일반 경로로 */ }
  }
  video.src = CONFIG.videoSrc;
}

function waitForMetadata() {
  return new Promise((resolve) => {
    if (video.readyState >= 1 && video.videoWidth) return resolve();
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    video.addEventListener('error', () => resolve(), { once: true });
  });
}

// iOS: 사용자가 버튼을 누른 순간에 한 번 재생해 둬야 나중에 소리와 함께 재생돼요
async function unlockVideo() {
  try {
    video.muted = false;
    await video.play();
    video.pause();
    video.currentTime = 0;
  } catch (e) {
    // 소리 있는 재생이 막히면 음소거로라도 재생
    video.muted = true;
    try { await video.play(); video.pause(); video.currentTime = 0; } catch (_) { /* ignore */ }
  }
  updateMuteIcon();
}

function updateMuteIcon() { $('muteBtn').textContent = video.muted ? '🔇' : '🔊'; }
$('muteBtn').addEventListener('click', () => {
  video.muted = !video.muted;
  if (!video.muted && video.paused && playing) video.play().catch(() => {});
  updateMuteIcon();
});

// ------------------------------------------------------------
//  자막
// ------------------------------------------------------------
let subtitles = CONFIG.subtitles || [];

function parseSrtTime(s) {
  const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
}
async function loadSrt(url) {
  const text = await (await fetch(url)).text();
  const blocks = text.replace(/\r/g, '').split(/\n\n+/);
  const list = [];
  for (const b of blocks) {
    const lines = b.split('\n').filter(Boolean);
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, z] = lines[ti].split('-->');
    list.push({ start: parseSrtTime(a), end: parseSrtTime(z), text: lines.slice(ti + 1).join('\n') });
  }
  return list;
}

let lastSubtitle = null;
function updateSubtitle() {
  const t = video.currentTime;
  const cur = playing ? subtitles.find((s) => t >= s.start && t < s.end) : null;
  const text = cur ? cur.text : null;
  if (text === lastSubtitle) return;
  lastSubtitle = text;
  if (text) { $('subtitle').firstElementChild.textContent = text; show('subtitle'); }
  else hide('subtitle');
}

// ------------------------------------------------------------
//  셰이더
// ------------------------------------------------------------
const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HOLO_FRAG = /* glsl */`
  uniform sampler2D uVideo;
  uniform float uTime;
  uniform float uReveal;
  uniform float uOpacity;
  uniform vec3  uTint;
  uniform float uTintAmount;
  uniform float uBrightness;
  uniform float uBlackCut;
  uniform float uScan;
  uniform float uFlicker;
  uniform float uGlitch;
  uniform float uGlitchBoost;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    vec2 uv = vUv;

    // 가끔 가로로 찢어지는 글리치
    float g = step(0.965, hash(floor(uTime * 12.0))) * uGlitch + uGlitchBoost;
    float band = step(0.55, hash(floor(uv.y * 24.0) + floor(uTime * 30.0)));
    uv.x += (hash(floor(uv.y * 60.0) + floor(uTime * 40.0)) - 0.5) * 0.05 * g * band;

    // 색수차
    vec2 ca = vec2(0.006 * g, 0.0);
    vec3 col;
    col.r = texture2D(uVideo, uv + ca).r;
    col.g = texture2D(uVideo, uv).g;
    col.b = texture2D(uVideo, uv - ca).b;

    // 검은 배경은 투명하게
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float keep = smoothstep(uBlackCut, uBlackCut + 0.08, lum);

    // 홀로그램 색조
    vec3 holo = uTint * (lum * 1.25 + 0.04);
    col = mix(col, holo, uTintAmount);

    // 스캔라인 + 위로 흐르는 밝은 띠 + 깜빡임
    float scan = 1.0 - uScan * (0.5 + 0.5 * sin(vUv.y * 420.0 - uTime * 6.0));
    float sweepPos = fract(uTime * 0.33);
    float sd = (vUv.y - sweepPos) * 30.0;
    float sweep = 1.0 + 0.5 * exp(-sd * sd);
    float flick = 1.0 - uFlicker * hash(floor(uTime * 24.0));

    // 사각형 테두리가 보이지 않게 가장자리 페이드
    float edge = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x))
               * smoothstep(0.0, 0.04, vUv.y) * (1.0 - smoothstep(0.96, 1.0, vUv.y));

    // 아래에서 위로 나타나는 연출
    float line = uReveal * 1.04;
    float shown = 1.0 - smoothstep(line - 0.01, line, vUv.y);
    float rd = (vUv.y - line) * 70.0;
    float revealEdge = exp(-rd * rd) * (1.0 - step(0.999, uReveal));

    vec3 outc = col * uBrightness * scan * sweep * flick * keep * edge * shown;
    outc += uTint * revealEdge * 0.9 * edge;

    gl_FragColor = vec4(outc * uOpacity, 1.0);
  }
`;

const BEAM_FRAG = /* glsl */`
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float x = abs(vUv.x - 0.5) * 2.0;
    float w = mix(0.3, 1.0, vUv.y);
    float a = (1.0 - smoothstep(w * 0.55, w, x)) * pow(1.0 - vUv.y, 1.7) * 0.22;
    a *= 0.85 + 0.15 * sin(uTime * 3.0 + vUv.y * 12.0);
    gl_FragColor = vec4(uTint * a * uOpacity, 1.0);
  }
`;

const RING_FRAG = /* glsl */`
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
    float r1 = (d - 0.72) * 14.0;
    float ring = exp(-r1 * r1) * (0.6 + 0.4 * pulse);
    float r2 = (d - fract(uTime * 0.6)) * 18.0;
    float ring2 = exp(-r2 * r2) * (1.0 - fract(uTime * 0.6)) * 0.6;
    float glow = pow(max(1.0 - d, 0.0), 2.0) * 0.35;
    float a = (ring + ring2 + glow) * (1.0 - smoothstep(0.92, 1.0, d));
    gl_FragColor = vec4(uTint * a * uOpacity, 1.0);
  }
`;

// ------------------------------------------------------------
//  홀로그램 오브젝트
// ------------------------------------------------------------
const tint = new THREE.Color(H.tint[0], H.tint[1], H.tint[2]);

const videoTexture = new THREE.VideoTexture(video);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.generateMipmaps = false;

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
};

const holoMat = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: HOLO_FRAG,
  uniforms: {
    uVideo: { value: videoTexture },
    uTime: { value: 0 },
    uReveal: { value: 0 },
    uOpacity: { value: 1 },
    uTint: { value: tint },
    uTintAmount: { value: H.tintAmount },
    uBrightness: { value: H.brightness },
    uBlackCut: { value: H.blackCut },
    uScan: { value: H.scanlines },
    uFlicker: { value: H.flicker },
    uGlitch: { value: H.glitch },
    uGlitchBoost: { value: 0 },
  },
  ...additive,
});

const beamMat = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: BEAM_FRAG,
  uniforms: { uTint: { value: tint }, uOpacity: { value: 0 }, uTime: { value: 0 } },
  ...additive,
});

const ringMat = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: RING_FRAG,
  uniforms: { uTint: { value: tint }, uOpacity: { value: 0 }, uTime: { value: 0 } },
  ...additive,
});

// 아래쪽 가운데가 원점인 평면
const bottomPlane = new THREE.PlaneGeometry(1, 1);
bottomPlane.translate(0, 0.5, 0);

const holo = new THREE.Group();           // 카메라를 바라보는 홀로그램 묶음
const holoPlane = new THREE.Mesh(bottomPlane, holoMat);
const beam = new THREE.Mesh(bottomPlane, beamMat);
holoPlane.renderOrder = 3;
beam.renderOrder = 2;
holoPlane.frustumCulled = false;
beam.frustumCulled = false;
holo.add(beam, holoPlane);

const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat); // 엽서 위 투사 링
ring.renderOrder = 1;
ring.frustumCulled = false;

function layoutHologram() {
  const h = H.height;
  const w = h * videoAspect;
  holoPlane.scale.set(w, h, 1);
  beam.scale.set(w * 1.15, h * 0.95, 1);
  beam.position.z = -0.001;
  ring.scale.setScalar(Math.max(0.35, w * 0.9));
}

// ------------------------------------------------------------
//  상태
// ------------------------------------------------------------
let stage = null;          // { renderer, scene, camera, anchorGroup }
let playing = false;       // 영상 재생 흐름이 시작됐는지
let ended = false;
let tracked = false;
let lostAt = 0;
let mode = 'anchor';       // 'anchor' (엽서 위) | 'screen' (화면 고정)
let revealStart = -1;
let hideStart = -1;
const clock = new THREE.Clock();

function attachToAnchor() {
  stage.anchorGroup.add(holo);
  holo.position.set(0, H.offsetY, H.lift);
  holo.scale.setScalar(1);
  mode = 'anchor';
}

function attachToScreen() {
  const cam = stage.camera;
  cam.add(holo);
  const d = cam.near * 50;
  const visH = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
  const visW = visH * cam.aspect;
  const h = H.height;
  const w = h * videoAspect;
  const s = Math.min((0.68 * visH) / h, (0.9 * visW) / w);
  holo.scale.setScalar(s);
  holo.position.set(0, -(s * h) / 2 + visH * 0.05, -d);
  holo.quaternion.identity();
  mode = 'screen';
  holoMat.uniforms.uGlitchBoost.value = 1;
}

function startPlayback() {
  playing = true;
  ended = false;
  hide('end');
  show('controls');
  video.currentTime = 0;
  video.play().catch(() => {
    // 혹시 막히면 음소거로 재생
    video.muted = true; updateMuteIcon();
    video.play().catch(() => {});
  });
  revealStart = clock.elapsedTime;
  hideStart = -1;
  holoMat.uniforms.uReveal.value = 0;
}

video.addEventListener('ended', () => {
  ended = true;
  hideStart = clock.elapsedTime;
  setTimeout(() => { if (ended) show('end'); }, 900);
});

$('replayBtn').addEventListener('click', () => {
  hide('end');
  if (!tracked && CONFIG.keepPlayingWhenLost && mode !== 'screen') attachToScreen();
  if (!tracked && !CONFIG.keepPlayingWhenLost) { playing = false; ended = false; show('hint'); return; }
  startPlayback();
});

function onFound() {
  tracked = true;
  hide('hint');
  if (mode !== 'anchor') { attachToAnchor(); holoMat.uniforms.uGlitchBoost.value = 1; }
  if (!playing) startPlayback();
}

function onLost() {
  tracked = false;
  lostAt = clock.elapsedTime;
  if (!playing) show('hint');
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) video.pause();
  else if (playing && !ended && (tracked || mode === 'screen')) video.play().catch(() => {});
});

// ------------------------------------------------------------
//  매 프레임
// ------------------------------------------------------------
const qa = new THREE.Quaternion();
const qc = new THREE.Quaternion();
let lastTick = 0;

function tick() {
  const t = clock.getElapsedTime();
  const dt = Math.min(Math.max(t - lastTick, 0), 0.05);
  lastTick = t;

  holoMat.uniforms.uTime.value = t;
  beamMat.uniforms.uTime.value = t;
  ringMat.uniforms.uTime.value = t;
  holoMat.uniforms.uGlitchBoost.value = Math.max(0, holoMat.uniforms.uGlitchBoost.value - dt * 2.5);

  // 나타나기 / 사라지기
  let reveal = 0;
  if (revealStart >= 0) reveal = Math.min(1, (t - revealStart) / H.revealSeconds);
  if (hideStart >= 0) reveal = Math.max(0, 1 - (t - hideStart) / 0.8);
  holoMat.uniforms.uReveal.value = playing ? reveal : 0;
  const glow = playing ? reveal : 0;
  beamMat.uniforms.uOpacity.value = mode === 'anchor' ? glow : 0;
  ringMat.uniforms.uOpacity.value = tracked ? Math.max(0.35, glow) : 0;

  // 엽서를 놓쳤을 때: 잠시 기다렸다가 화면 고정 모드로
  if (playing && !ended && !tracked && mode === 'anchor' && t - lostAt > CONFIG.lostDelaySeconds) {
    if (CONFIG.keepPlayingWhenLost) attachToScreen();
    else { video.pause(); }
  }
  if (!CONFIG.keepPlayingWhenLost && playing && !ended && tracked && video.paused && !document.hidden) {
    video.play().catch(() => {});
  }

  // 엽서 위에 있을 때는 항상 카메라를 바라보게
  if (mode === 'anchor' && holo.parent === stage.anchorGroup) {
    stage.anchorGroup.getWorldQuaternion(qa);
    stage.camera.getWorldQuaternion(qc);
    holo.quaternion.copy(qa.invert().multiply(qc));
  }

  updateSubtitle();
  stage.renderer.render(stage.scene, stage.camera);
}

// ------------------------------------------------------------
//  AR 모드 (MindAR)
// ------------------------------------------------------------
async function startAR() {
  // 인식 파일이 있는지 먼저 확인
  try {
    const res = await fetch(CONFIG.targetSrc, { method: 'HEAD' });
    if (!res.ok) throw new Error('missing');
  } catch (e) {
    showError('엽서 인식 파일이 없어요',
      `${CONFIG.targetSrc} 파일을 찾을 수 없어요.\nMindAR 컴파일러로 엽서 이미지를 변환해서\nassets 폴더에 targets.mind 로 넣어 주세요.`);
    return;
  }

  let MindARThree;
  try {
    ({ MindARThree } = await import('mindar-image-three'));
  } catch (e) {
    showError('불러오기 실패', '인터넷 연결을 확인하고 다시 시도해 주세요.');
    return;
  }

  const mindar = new MindARThree({
    container: $('stage'),
    imageTargetSrc: CONFIG.targetSrc,
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
  });
  const { renderer, scene, camera } = mindar;
  const anchor = mindar.addAnchor(0);
  stage = { renderer, scene, camera, anchorGroup: anchor.group };

  scene.add(camera); // 화면 고정 모드에서 카메라 자식으로 붙이기 위해
  anchor.group.add(ring);
  ring.position.set(0, H.offsetY, 0.002);
  attachToAnchor();

  anchor.onTargetFound = onFound;
  anchor.onTargetLost = onLost;

  try {
    await mindar.start();
  } catch (e) {
    const denied = e && (e.name === 'NotAllowedError' || /permission|denied/i.test(String(e.message || e)));
    showError(denied ? '카메라 권한이 필요해요' : '카메라를 켤 수 없어요',
      denied
        ? '브라우저 설정에서 이 사이트의 카메라 권한을 허용한 뒤\n다시 시도해 주세요.\n(아이폰: 설정 → Safari → 카메라 → 허용)'
        : '다른 앱이 카메라를 쓰고 있지 않은지 확인하고,\n사파리나 크롬에서 열어 주세요.');
    return;
  }

  hide('loading');
  show('hint');
  renderer.setAnimationLoop(tick);
}

// ------------------------------------------------------------
//  미리보기 모드 (카메라 없이 효과 확인)
// ------------------------------------------------------------
async function startPreview() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  $('stage').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b10);
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100);
  scene.add(camera);

  // 테이블 위에 놓인 엽서 흉내
  const anchorGroup = new THREE.Group();
  anchorGroup.rotation.x = -Math.PI / 2 + 0.25;
  scene.add(anchorGroup);

  const tex = await new THREE.TextureLoader().loadAsync(CONFIG.postcardImage).catch(() => null);
  let cardAspect = 1358 / 2067;
  if (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    cardAspect = tex.image.height / tex.image.width;
  }
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(1, cardAspect),
    new THREE.MeshBasicMaterial({ map: tex || null, color: tex ? 0xffffff : 0x223344 }),
  );
  anchorGroup.add(card);
  anchorGroup.add(ring);
  ring.position.set(0, H.offsetY, 0.002);

  stage = { renderer, scene, camera, anchorGroup };
  attachToAnchor();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (mode === 'screen') attachToScreen();
  });

  show('previewBar');
  $('simLost').onclick = () => onLost();
  $('simFound').onclick = () => onFound();

  hide('loading');
  renderer.setAnimationLoop(() => {
    const t = clock.elapsedTime;
    const a = Math.sin(t * 0.25) * 0.45;
    camera.position.set(Math.sin(a) * 1.9, 1.15, Math.cos(a) * 1.9);
    camera.lookAt(0, 0.35, 0);
    tick();
  });
  onFound();
}

// ------------------------------------------------------------
//  시작
// ------------------------------------------------------------
$('startBtn').addEventListener('click', async () => {
  hide('start');
  $('loadingText').textContent = PREVIEW ? '미리보기를 준비하는 중…' : '카메라를 켜는 중…';
  show('loading');

  // 버튼을 누른 이 순간에 영상 소리 잠금 해제 (아이폰 필수)
  const unlock = unlockVideo();

  if (CONFIG.subtitlesSrt) {
    try { subtitles = await loadSrt(CONFIG.subtitlesSrt); } catch (e) { /* 기본 자막 사용 */ }
  }

  await unlock;
  await waitForMetadata();
  if (video.videoWidth && video.videoHeight) videoAspect = video.videoWidth / video.videoHeight;
  layoutHologram();

  if (PREVIEW) startPreview();
  else startAR();
});

// 영상 소스는 페이지가 열리자마자 미리 불러오기 시작
// (소스가 준비된 뒤에 버튼을 눌러야 아이폰에서 소리 잠금 해제가 확실해요)
$('startBtn').disabled = true;
loadVideoSource().finally(() => { $('startBtn').disabled = false; });
