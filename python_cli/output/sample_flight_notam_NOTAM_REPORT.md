# ✈️ NOTAM & 비행계획 항로 준수성 분석 리포트 (RKSI ➔ KLAX)
- **문서 파일명**: `sample_flight_notam.pdf`
- **총 분석 NOTAM 수**: 10건
- **위험도 현황**: 🔴 CRITICAL 3건 | 🟡 CAUTION 4건 | ⚪ INFO 2건 | ⚪ SHADED 1건
- **항로 규정 준수 검증**: ✅ 준수 1건 | ⚠️ 주의/모니터링 0건 | 🚨 위반 0건

## 🧭 1. 항로상 비행계획 NOTAM 준수성 자동 검증 (Flight Plan Compliance)
| 검증 항목 | 근거 NOTAM/규정 | 준수 여부 | 비행계획(FPL) 반영 근거 & 상세 분석 |
|---|---|:---:|---|
| **인천 FIR 군 훈련 GPS 신호 교란 및 수도권 비행금지구역 회피 검증** | `RKRR Z0555/26, D1768/26` | **✅ COMPLIANT** | **근거:** `동남측 KARBU 픽스 경유 표준 계기접근 절차(STAR)로 비행금지구역 완전 회피`<br>*비행금지구역을 안전하게 회피하는 표준 도착 절차로 수립되었으며, GPS 신호 교란 대비 VOR/DME 모니터링이 권장됩니다.* |

## 🔴 2. 운항 직결 핵심 NOTAM (CRITICAL)
| 공항 | ID / 구분 | 분류 | 한국어 요약 & 조종사 조치사항 | 유효기간 |
|---|---|---|---|---|
| **RKSI** | `RKSI A1024/26` | RUNWAY | **[RKSI] 활주로 15L/33R 공사/정비로 인한 일시 폐쇄.**<br>💡 *⚠️ 사용 가능 활주로(TORA/LDA) 사전 확인 및 출발/접근 브리핑 시 활주로 배정 상태 필히 재확인.* | `10AUG26 00:00 ~ 31AUG26 23:59` |
| **RKSI** | `RKSI A1028/26` | NAVAID | **[RKSI] 글라이드패스 (GP) 정비/결함으로 일시 운용 불능 (U/S).**<br>💡 *🚨 정밀접근(CAT II/III) 불가 여부 확인, 비정밀접근(RNP/VOR/LOC Only) 최저치(Minima) 및 연료 대비.* | `10AUG26 01:00 ~ 30SEP26 12:00` |
| **KLAX** | `KLAX A4510/26` | RUNWAY | **[KLAX] 활주로 07L/25R 공사/정비로 인한 일시 폐쇄.**<br>💡 *⚠️ 사용 가능 활주로(TORA/LDA) 사전 확인 및 출발/접근 브리핑 시 활주로 배정 상태 필히 재확인.* | `09JUL26 12:00 ~ 30SEP26 23:59` |

## 🟡 3. 운항 주의 NOTAM (CAUTION)
| 공항 | ID / 구분 | 분류 | 한국어 요약 & 조종사 조치사항 | 유효기간 |
|---|---|---|---|---|
| **RKSI** | `RKSI A1025/26` | TAXIWAY | [RKSI] 유도로 M1, M2 구간 공사/점검으로 폐쇄.<br>*지상 활주(Taxi) 시 우회 경로 숙지 및 지상 관제 지시(Hold Short/Taxi Route) 철저 준수.* | `10AUG26 00:00 ~ 15SEP26 23:59` |
| **KLAX** | `KLAX A4522/26` | LIGHTING | [KLAX] 정밀진입각지시등 (PAPI) 운용 불능 (U/S) 또는 점검 중.<br>*야간/저시정 접근 시 시각 참조 제한 유의 및 기상 최저치(Vis/RVR) 증가 여부 점검.* | `12JUL26 08:00 ~ 15OCT26 23:59` |
| **KSAN** | `KSAN A1102/26` | TAXIWAY | [KSAN] 유도로 B 구간 공사/점검으로 폐쇄.<br>*지상 활주(Taxi) 시 우회 경로 숙지 및 지상 관제 지시(Hold Short/Taxi Route) 철저 준수.* | `01AUG26 00:00 ~ 31AUG26 23:59` |
| **PANC** | `PANC A4415/26` | LIGHTING | [PANC] 정밀진입각지시등 (PAPI) 운용 불능 (U/S) 또는 점검 중.<br>*야간/저시정 접근 시 시각 참조 제한 유의 및 기상 최저치(Vis/RVR) 증가 여부 점검.* | `09JUL26 12:05 ~ 30SEP27 12:05` |

## 📋 4. 공항별 전체 NOTAM 목록
### 📍 KLAX (3건)
- **[CRITICAL]** `KLAX A4510/26` (RUNWAY): [KLAX] 활주로 07L/25R 공사/정비로 인한 일시 폐쇄.
  - 💡 *조치사항: ⚠️ 사용 가능 활주로(TORA/LDA) 사전 확인 및 출발/접근 브리핑 시 활주로 배정 상태 필히 재확인.*
- **[CAUTION]** `KLAX A4522/26` (LIGHTING): [KLAX] 정밀진입각지시등 (PAPI) 운용 불능 (U/S) 또는 점검 중.
  - 💡 *조치사항: 야간/저시정 접근 시 시각 참조 제한 유의 및 기상 최저치(Vis/RVR) 증가 여부 점검.*
- **[INFO]** `KLAX A4301/26` (RUNWAY): [KLAX] 공항 반경 내 조류 집중 서식/활동 주의보.
  - 💡 *조치사항: 이착륙 시 윈드실드/엔진 조류 충돌(Bird Strike) 경계, 조명(Landing Light) 활용 점등 권장.*

### 📍 KSAN (1건)
- **[CAUTION]** `KSAN A1102/26` (TAXIWAY): [KSAN] 유도로 B 구간 공사/점검으로 폐쇄.
  - 💡 *조치사항: 지상 활주(Taxi) 시 우회 경로 숙지 및 지상 관제 지시(Hold Short/Taxi Route) 철저 준수.*

### 📍 PANC (1건)
- **[CAUTION]** `PANC A4415/26` (LIGHTING): [PANC] 정밀진입각지시등 (PAPI) 운용 불능 (U/S) 또는 점검 중.
  - 💡 *조치사항: 야간/저시정 접근 시 시각 참조 제한 유의 및 기상 최저치(Vis/RVR) 증가 여부 점검.*

### 📍 RKSI (5건)
- **[CRITICAL]** `RKSI A1024/26` (RUNWAY): [RKSI] 활주로 15L/33R 공사/정비로 인한 일시 폐쇄.
  - 💡 *조치사항: ⚠️ 사용 가능 활주로(TORA/LDA) 사전 확인 및 출발/접근 브리핑 시 활주로 배정 상태 필히 재확인.*
- **[CAUTION]** `RKSI A1025/26` (TAXIWAY): [RKSI] 유도로 M1, M2 구간 공사/점검으로 폐쇄.
  - 💡 *조치사항: 지상 활주(Taxi) 시 우회 경로 숙지 및 지상 관제 지시(Hold Short/Taxi Route) 철저 준수.*
- **[CRITICAL]** `RKSI A1028/26` (NAVAID): [RKSI] 글라이드패스 (GP) 정비/결함으로 일시 운용 불능 (U/S).
  - 💡 *조치사항: 🚨 정밀접근(CAT II/III) 불가 여부 확인, 비정밀접근(RNP/VOR/LOC Only) 최저치(Minima) 및 연료 대비.*
- **[INFO]** `RKSI A0912/26` (OBSTACLE): [RKSI] 공항 인근 크레인/구조물 장애물 설치 (최고 높이 185FT).
  - 💡 *조치사항: 이착륙 경로 상 장애물 여부 및 시계 접근 시 주의.*
- **[SHADED]** `RKSI A0800/26` (PROCEDURE) `[음영: AIP SUP / AIRAC 최신 차트 기 반영 항목]`: [RKSI] AIP SUP / AIRAC 개정 사항 사전 고시 (Trigger NOTAM).
  - 💡 *조치사항: 차트 개정판 기 반영 여부 확인 (일반 운항 시 추가 조치 불요).*
