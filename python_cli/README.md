# ✈️ NOTAM Deep Analyzer (항공고시보 전문 분석 도구)

비행계획서(OFP), 비행 브리핑 패키지, NOTAM 전문 PDF 문서에서 **NOTAM(Notice to Air Missions)만 정밀하게 추출·분류·해독**하여 조종사 및 운항관리사를 위한 고품질 대시보드와 리포트를 생성하는 독립형 Python 도구입니다.

---

## 🌟 주요 기능

1. **ICAO 전문 축약어 자동 해독 & 한국어 요약**
   * 난해한 영문 약어(`WIP`, `CLSD`, `U/S`, `ALS`, `PAPI`, `TORA`, `LDA`, `CAT II/III`, `SA CAT I`, `RCLL` 등)를 한국어로 자연스럽게 번역
   * 조종사를 위한 **실질적 운항 조치사항(Operational Action Tip)** 자동 제시

2. **운항 영향도(Priority) 및 음영(Shading) 필터링**
   * 🔴 **CRITICAL (운항 직결)**: 활주로 폐쇄(`RWY CLSD`), ILS/LOC/GP 정밀접근 불가(`U/S`), 공항 폐쇄, 비상 공역
   * 🟡 **CAUTION (운항 주의)**: 유도로 폐쇄(`TWY CLSD`), PAPI/ALS 등화 결함, VOR/DME 점검, 주기장 공사
   * ⚪ **INFO (일반 참고)**: 조류 주의, 일반 장애물(크레인), 절차 변경
   * ⚪ **SHADED (노이즈 자동 분리)**: AIP SUP/AIRAC 사전 고시(Trigger NOTAM), 저고도 VFR 전용, 타 기종 한정 고시 자동 음영 처리

3. **다양한 출력 포맷 지원**
   * 🌐 **인터랙티브 HTML 대시보드**: 다크모드, 공항별 탭, 카테고리 필터, 실시간 키워드 검색, 원문-해독문 토글, 인쇄/PDF 저장 최적화
   * 📝 **Markdown 리포트 (`.md`)**: 문서 정리 및 EFB용 마크다운 요약본
   * 📊 **CSV / Excel 스프레드시트 (`.csv`)**: 엑셀 분석 및 통계용 데이터
   * 📦 **JSON 데이터 (`.json`)**: 타 시스템 연동용 규격화 데이터

---

## 🚀 빠른 시작 가이드 (Quick Start)

### 1. 패키지 설치
```bash
cd C:\Users\moons\.gemini\antigravity\scratch\notam-analyzer
pip install -r requirements.txt
```

### 2. 기본 분석 실행 (모든 포맷 자동 생성)
```bash
python analyze_notam.py "C:\경로\비행문서.pdf"
```

### 3. 브라우저로 대시보드 즉시 열기
```bash
python analyze_notam.py "C:\경로\비행문서.pdf" --open
```

### 4. 특정 포맷 및 출력 폴더 지정
```bash
# HTML만 생성하고 특정 폴더에 저장
python analyze_notam.py "C:\경로\비행문서.pdf" -o ./my_reports -f html --open

# CSV(엑셀)만 생성
python analyze_notam.py "C:\경로\비행문서.pdf" -f csv
```

---

## 🛠️ CLI 옵션 상세

| 옵션 | 설명 | 기본값 |
|---|---|---|
| `pdf_path` | 분석할 PDF 파일 경로 (필수) | - |
| `-o, --output` | 결과 파일이 저장될 출력 디렉터리 | `./output` |
| `-f, --format` | 출력 포맷 (`all`, `html`, `md`, `json`, `csv`) | `all` |
| `--open` | 분석 완료 후 생성된 HTML 대시보드를 웹 브라우저에서 자동 실행 | `False` |

---

## 📂 프로젝트 구조

```
notam-analyzer/
├── analyze_notam.py          # 메인 CLI 실행 스크립트
├── requirements.txt          # 의존성 정의
├── README.md                 # 사용 설명서
├── notam_analyzer/           # 핵심 엔진 패키지
│   ├── __init__.py
│   ├── extractor.py          # PDF 텍스트 추출 및 섹션 탐지
│   ├── parser.py             # NOTAM 블록 파싱 및 정규화
│   ├── classifier.py         # 카테고리 분류 및 위험도/음영 엔진
│   ├── decoder.py            # ICAO 약어 해독 사전 및 한국어 조치 팁 생성
│   ├── gemini_enhancer.py    # (선택) Gemini AI 종합 위협 분석기
│   └── reporters/
│       ├── html_reporter.py  # 반응형 다크모드 HTML 대시보드 생성기
│       └── markdown_reporter.py # Markdown, JSON, CSV 리포터
└── output/                   # 분석 결과 저장 폴더
```
