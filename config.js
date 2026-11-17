// ============================================================
//  산타 홀로그램 엽서 AR — 설정 파일
//  이 파일만 고치면 영상, 자막, 링크, 홀로그램 느낌을 바꿀 수 있어요.
// ============================================================

export const CONFIG = {
  // 엽서 인식 데이터 (MindAR 컴파일러로 만든 파일)
  targetSrc: './assets/targets.mind',

  // 산타 영상 (검은 배경, H.264 MP4 권장)
  videoSrc: './assets/santa.mp4',

  // 미리보기 화면에 쓰는 엽서 이미지
  postcardImage: './assets/postcard.jpg',

  // 영상이 끝나면 나오는 "문의하기" 버튼 링크
  storeUrl: 'https://smartstore.naver.com/',
  storeButtonText: '스마트스토어 문의하기',

  // true면 카메라 없이 미리보기 모드로 열려요 (주소 끝에 #preview 를 붙여도 같아요)
  forcePreview: false,

  // 엽서를 화면에서 놓쳐도 영상을 화면에 띄운 채 끝까지 재생
  keepPlayingWhenLost: true,
  // 엽서를 놓친 뒤 몇 초 지나면 화면 고정 모드로 바꿀지
  lostDelaySeconds: 0.6,

  hologram: {
    tint: [0.45, 0.85, 1.0], // 홀로그램 색 (R, G, B / 0~1)
    tintAmount: 0.35,        // 0 = 영상 원래 색, 1 = 완전히 푸른 홀로그램
    brightness: 1.3,         // 전체 밝기
    blackCut: 0.06,          // 이 밝기보다 어두운 부분은 투명 처리 (검은 사각형이 보이면 올리기)
    scanlines: 0.18,         // 가로 줄무늬 세기
    flicker: 0.08,           // 깜빡임 세기
    glitch: 1.0,             // 가끔 지지직 튀는 효과 (0 = 끄기)
    height: 1.1,             // 홀로그램 높이 (엽서 가로폭 = 1 기준)
    offsetY: -0.05,          // 엽서 중심에서 위아래 위치
    lift: 0.08,              // 엽서에서 떠 있는 높이
    revealSeconds: 1.2,      // 처음 나타날 때 아래에서 위로 스캔되는 시간
  },

  // 자막: start/end 는 초 단위. 실제 산타 영상이 나오면 시간을 맞춰 주세요.
  // SRT 파일을 쓰고 싶으면 subtitlesSrt: './assets/santa.srt' 처럼 지정하면 아래 목록 대신 그걸 써요.
  subtitlesSrt: null,
  subtitles: [
    { start: 0.0,  end: 2.5,  text: '오! 연결됐다!' },
    { start: 2.5,  end: 5.5,  text: '너 크리스마스에 카멜레온 갖고 싶었다며?' },
    { start: 5.5,  end: 9.5,  text: '호호호, 우리 실험실에서 막 태어난 아기 카멜레온이란다.' },
    { start: 9.5,  end: 14.0, text: '먼저 같이 넣어 둔 마모방지 스티커를 에어팟 케이스에 붙여 주렴.' },
    { start: 14.0, end: 18.5, text: '그다음 꼬리와 앞다리 사이로 케이스를 쏙 밀어 넣으면 돼.' },
    { start: 18.5, end: 23.5, text: '아, 앞다리는 아직 아기라서 너무 세게 밀면 다칠 수 있어.' },
    { start: 23.5, end: 25.5, text: '살살, 알겠지?' },
    { start: 25.5, end: 28.5, text: '그리고 이 녀석은 더위를 정말 싫어해.' },
    { start: 28.5, end: 33.5, text: '한여름 차 안처럼 뜨거운 곳에 두면 몸이 휘어질 수 있단다.' },
    { start: 33.5, end: 37.5, text: '더러워지면 물기를 살짝 묻힌 천으로 닦아 주렴.' },
    { start: 37.5, end: 41.5, text: '혹시 어딘가 아프거나 헐렁해지면 혼자 고치지 말고,' },
    { start: 41.5, end: 46.0, text: '스마트스토어에서 문의하기를 눌러 줘. 연구소에서 바로 도와줄게.' },
    { start: 46.0, end: 49.0, text: '이름은 네가 지어 주렴.' },
    { start: 49.0, end: 53.0, text: '메리 크리스마스! 호호호!' },
  ],
};
