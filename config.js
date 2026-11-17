// ============================================================
//  산타 홀로그램 엽서 AR — 설정 파일
//  이 파일만 고치면 영상, 자막, 링크, 홀로그램 느낌을 바꿀 수 있어요.
// ============================================================

export const CONFIG = {
  // 엽서 인식 데이터 (MindAR 컴파일러로 만든 파일)
  targetSrc: './assets/targets.mind',

  // 산타 영상 (검은 배경, H.264 MP4 권장)
  videoSrc: './assets/santa.mp4?v=20261117c',

  // 미리보기 화면에 쓰는 엽서 이미지
  postcardImage: './assets/postcard.jpg',

  // 영상이 끝나면 나오는 "문의하기" 버튼 링크
  storeUrl: 'https://smartstore.naver.com/',
  storeButtonText: '스마트스토어 문의하기',

  // true면 카메라 없이 미리보기 모드로 열려요 (주소 끝에 #preview 를 붙여도 같아요)
  forcePreview: false,

  // true = 영상 아래쪽 절반에 투명도 마스크가 들어 있는 영상이에요 (배경이 진짜 투명해져요)
  alphaPacked: true,

  // 엽서를 화면에서 놓쳐도 영상을 화면에 띄운 채 끝까지 재생
  keepPlayingWhenLost: true,
  // 엽서를 놓친 뒤 몇 초 지나면 화면 고정 모드로 바꿀지
  lostDelaySeconds: 0.6,

  hologram: {
    tint: [0.45, 0.85, 1.0], // 홀로그램 색 (R, G, B / 0~1)
    tintAmount: 0.22,        // 0 = 영상 원래 색, 1 = 완전히 푸른 홀로그램
    brightness: 1.3,         // 전체 밝기
    blackCut: 0.06,          // 이 밝기보다 어두운 부분은 투명 처리 (검은 사각형이 보이면 올리기)
    scanlines: 0.12,         // 가로 줄무늬 세기
    flicker: 0.08,           // 깜빡임 세기
    glitch: 1.0,             // 가끔 지지직 튀는 효과 (0 = 끄기)
    height: 1.1,             // 홀로그램 높이 (엽서 가로폭 = 1 기준)
    offsetY: -0.05,          // 엽서 중심에서 위아래 위치
    lift: 0.08,              // 엽서에서 떠 있는 높이
    revealSeconds: 1.2,      // 처음 나타날 때 아래에서 위로 스캔되는 시간
  },

  // 자막: 지금 영상은 화면 안에 글자가 들어 있어서 자막을 끄고 있어요.
  // 나중에 자막이 필요하면 { start: 0.0, end: 2.5, text: '문장' } 형식으로 넣으면 돼요.
  subtitlesSrt: null,
  subtitles: [],
};
