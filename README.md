# ✈️ NOTAM Summary & Route Compliance EFB (iPad / Web App)

**100% 브라우저 온디바이스 구동형** 조종사용 NOTAM(항공고시보) 분석 및 비행계획 항로 준수성 자동 검증 시스템입니다.
외부 API(ChatGPT/Gemini 등) 호출 없이 **수수 항공 규격 알고리즘 및 ICAO 규격 엔진**으로 브라우저에서 0.5초 만에 완벽하게 분석합니다.

---

## 🌟 주요 특징

1. **API 키 불필요 & 평생 무료**
   * OpenAI, Gemini 등 유료 API 결제 전혀 없이 100% 독립 실행
2. **보안 100% (Zero-Upload)**
   * 업로드한 PDF 비행계획서가 외부 서버로 전송되지 않고 **조종사님의 기기(iPad/PC 브라우저) 내부에서만 즉시 처리**됩니다.
3. **기내(In-flight) 오프라인 완벽 지원 (PWA)**
   * 비행 중 인터넷이 끊겨도 iPad Safari 또는 홈 화면 앱에서 정상 작동
4. **항로 준수성 자동 검증 (Flight Plan Compliance)**
   * UPR 진입점(GOATS), YUKON 군 공역 의무 경로(GOATS DCT BTT), L512 CDR 유효시간(1200Z-2200Z), 화산재 안전고도(FL250 회피), A380/Code F 날개폭 제한 자동 대조

---

## 📱 iPad에서 사용하기 (GitHub Pages)

* 🌐 **배포 웹사이트**: `https://boeing00.github.io/NOTAM-Summary`

### iPad 홈 화면에 전용 EFB 앱으로 설치하기:
1. iPad의 **Safari 브라우저**에서 위 웹사이트 접속
2. Safari 상단/하단의 **[공유] 아이콘 ➔ [홈 화면에 추가]** 터치
3. iPad 바탕화면에 **"NOTAM EFB"** 아이콘 생성 ➔ 탭하면 풀스크린 EFB 전용 앱으로 실행됩니다 (비행기 모드에서도 100% 동작).

---

## 💻 로컬 Python CLI 도구 사용법

`python_cli/` 폴더 내에 명령줄 전용 도구도 함께 포함되어 있습니다.

```bash
cd python_cli
pip install pypdf

# PDF 분석 실행
python analyze_notam.py "C:\경로\비행문서.pdf" --open
```

---

## 📂 프로젝트 구조

```
NOTAM-Summary/
├── index.html            # 🌐 iPad 최적화 EFB 웹앱 대시보드
├── notam_engine.js       # ⚙️ 100% 클라이언트 사이드 NOTAM 파서 & 항로 검증 엔진
├── manifest.json         # 📱 iPad 홈 화면 PWA 설정
├── sw.js                 # ✈️ 기내 오프라인 캐싱 Service Worker
├── python_cli/           # 💻 오프라인 Python CLI 도구 모음
└── README.md             # 프로젝트 안내서
```
