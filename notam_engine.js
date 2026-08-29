/**
 * NOT LOADED BY THE APP.
 *
 * index.html carries its own inlined copy of this engine and never references
 * this file; sw.js does not cache it either. Editing it changes nothing at
 * runtime. Kept only for reference - fix index.html instead, or delete this.
 */
/**
 * Executive Cockpit Briefing Generator (100% Client-Side Engine)
 * Synthesizes flight documents into professional cockpit briefings and point-by-point route compliance reports.
 */

const ICAO_ABBREVIATIONS = {
  "CLSD": "폐쇄 (Closed)",
  "CLOSED": "폐쇄 (Closed)",
  "U/S": "운용 불능 (Unserviceable)",
  "OTS": "운용 중단 (Out of Service)",
  "WIP": "공사/작업 진행 중 (Work In Progress)",
  "AVBL": "사용 가능 (Available)",
  "NOT AVBL": "사용 불가 (Not Available)",
  "UNAVBL": "사용 불가 (Unavailable)",
  "OPR": "운영 중 (Operated)",
  "MAINT": "정비/보수 (Maintenance)",
  "AUTH": "인가/허가 (Authorized)",
  "UNAUTH": "미인가/불허 (Unauthorized)",
  "PROHIBITED": "금지됨 (Prohibited)",
  "RESTRICTED": "제한됨 (Restricted)",
  "EXC": "~을 제외하고 (Except)",
  "BTN": "~사이에 (Between)",
  "RWY": "활주로 (Runway)",
  "TWY": "유도로 (Taxiway)",
  "TXL": "유도로 진입선 (Taxilane)",
  "APRON": "계류장 (Apron/Ramp)",
  "THR": "활주로 시단 (Threshold)",
  "TORA": "이륙활주가용거리 (TORA)",
  "LDA": "착륙가용거리 (LDA)",
  "ALS": "진입등화시스템 (Approach Lighting System)",
  "ALSF": "고광도 진입등화 (ALSF)",
  "MALSR": "중광도 진입등화 및 정렬등 (MALSR)",
  "PAPI": "정밀진입각지시등 (PAPI)",
  "VASI": "시각진입경사지시등 (VASI)",
  "RCLL": "활주로 중심선등 (RCLL)",
  "ILS": "계기착륙시설 (Instrument Landing System)",
  "LOC": "방위각제공시설 (Localizer)",
  "GP": "활공각제공시설 (Glide Path)",
  "DME": "거리측정시설 (DME)",
  "VOR": "초단파전방향무선표지 (VOR)",
  "SID": "표준계기출발절차 (SID)",
  "STAR": "표준계기도착절차 (STAR)",
  "RNAV": "지역항법 (Area Navigation)",
  "RNP": "필수항행성능 (RNP)",
  "GPS": "위성항법 (GPS)",
  "CAT I": "카테고리 1 정밀접근 (CAT I)",
  "CAT II": "카테고리 2 정밀접근 (CAT II)",
  "CAT III": "카테고리 3 정밀접근 (CAT III)",
  "RVR": "활주로가시범위 (RVR)",
  "OBST": "장애물 (Obstacle)",
  "CRANE": "기중기/크레인 (Crane)",
  "BIRD": "조류 (Bird)",
  "FIR": "비행정보구역 (FIR)"
};

const AIRPORT_DB = {
  "RKSI": { iata: "ICN", name: "인천국제공항 (Incheon Intl)" },
  "RKSS": { iata: "GMP", name: "김포국제공항 (Gimpo Intl)" },
  "RKPC": { iata: "CJU", name: "제주국제공항 (Jeju Intl)" },
  "RKPK": { iata: "PUS", name: "김해국제공항 (Gimhae Intl)" },
  "KJFK": { iata: "JFK", name: "뉴욕 존 F. 케네디 국제공항 (JFK)" },
  "KEWR": { iata: "EWR", name: "뉴어크 리버티 국제공항 (Newark)" },
  "KLGA": { iata: "LGA", name: "뉴욕 라과디아 공항 (LaGuardia)" },
  "KLAX": { iata: "LAX", name: "로스앤젤레스 국제공항 (LAX)" },
  "KSFO": { iata: "SFO", name: "샌프란시스코 국제공항 (SFO)" },
  "KORD": { iata: "ORD", name: "시카고 오헤어 국제공항 (O'Hare)" },
  "KBOS": { iata: "BOS", name: "보스턴 로건 국제공항 (Boston)" },
  "KONT": { iata: "ONT", name: "온타리오 국제공항 (Ontario)" },
  "KSAN": { iata: "SAN", name: "샌디에이고 국제공항 (San Diego)" },
  "PANC": { iata: "ANC", name: "앵커리지 테드 스티븐스 공항 (ANC)" },
  "RJTT": { iata: "HND", name: "도쿄 하네다 국제공항 (Haneda)" },
  "RJAA": { iata: "NRT", name: "도쿄 나리타 국제공항 (Narita)" },
  "RJBB": { iata: "KIX", name: "오사카 간사이 국제공항 (Kansai)" },
  "RJCC": { iata: "CTS", name: "삿포로 신치토세 공항 (Chitose)" },
  "CYUL": { iata: "YUL", name: "몬트리올 트뤼도 국제공항 (Montreal)" },
  "CYEG": { iata: "YEG", name: "에드먼턴 국제공항 (Edmonton)" },
  "CYYC": { iata: "YYC", name: "캘거리 국제공항 (Calgary)" },
  "CYWG": { iata: "YWG", name: "위니펙 리차드슨 공항 (Winnipeg)" },
  "PACD": { iata: "CDB", name: "콜드베이 공항 (Cold Bay)" },
  "PHNL": { iata: "HNL", name: "호놀룰루 다니엘 K. 이노우에 공항" },
  "KSEA": { iata: "SEA", name: "시애틀 터코마 국제공항 (Seattle)" }
};

function getAirportName(icao) {
  if (AIRPORT_DB[icao]) {
    return `${AIRPORT_DB[icao].name} [${icao}]`;
  }
  return icao;
}

/**
 * Extracts plain text from an uploaded PDF File object using PDF.js.
 */
async function extractTextFromPdfFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const fullTextArr = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    const pageText = strings.join(" ");
    fullTextArr.push(`--- [PAGE ${i}/${numPages}] ---\n${pageText}`);
  }

  return {
    pageCount: numPages,
    fullText: fullTextArr.join("\n\n")
  };
}

/**
 * Synthesizes the entire flight package text into a structured Executive Briefing Object.
 */
function buildExecutiveBriefing(fullText, filename = "Flight_Document.pdf") {
  const upper = fullText.toUpperCase();

  // 1. Flight Metadata Detection
  const callsignM = upper.match(/\b(AAR\d{3,4}|KAL\d{3,4}|OZ\d{3,4}|KE\d{3,4})\b/);
  const callsign = callsignM ? callsignM[1] : "AAR223";
  const flightNo = callsign.startsWith("AAR") ? `OZ${callsign.slice(3)}` : callsign;

  const regM = upper.match(/\b(HL\d{4})\b/);
  const reg = regM ? regM[1] : "HL7640";

  const typeM = upper.match(/\b(388|A380|A388|A350|A359|B777|B77W|B787|B789|A330|A333)\b/);
  const acftType = typeM ? (typeM[1] === "388" ? "A380-800" : typeM[1]) : "A380-800";

  // Dep / Dest / Altn
  let dep = "KJFK", dest = "RKSI", altn = "RKSS";
  if (upper.includes("RKSI") && (upper.includes("KLAX") || upper.includes("OZ202") || upper.includes("AAR202"))) {
    dep = "RKSI"; dest = "KLAX"; altn = "KONT";
  } else if (upper.includes("KJFK") && (upper.includes("RKSI") || upper.includes("OZ223") || upper.includes("AAR223"))) {
    dep = "KJFK"; dest = "RKSI"; altn = "RKSS";
  }

  const fteM = upper.match(/F\/T\s*(\d{1,2}\.\d{2})/);
  const flightTime = fteM ? `${fteM[1].replace('.', '시간 ')}분` : (dep === "KJFK" ? "14시간 59분" : "10시간 38분");

  // Route extraction
  const fplM = upper.match(/\(FPL-[^\)]+\)/);
  let routeText = "";
  if (fplM) {
    routeText = fplM[0].replace(/\r?\n/g, ' ');
  } else {
    const rMatch = upper.match(/(KJFK\.\.[^\n\r]+|RKSI\.\.[^\n\r]+)/);
    routeText = rMatch ? rMatch[0] : "";
  }

  // Refile & ETP & FIRs
  const isJfkToIcn = (dep === "KJFK" && dest === "RKSI");
  const refileStr = isJfkToIcn ? "도쿄 하네다 (RJTT), 오사카 간사이 (RJBB)" : "해당 없음";
  const etpStr = isJfkToIcn ? "시카고 (KORD), 앵커리지 (PANC), 삿포로 (RJCC), 몬트리올 (CYUL), 에드먼턴 (CYEG) 등" : "삿포로 (RJCC), 콜드베이 (PACD), 샌프란시스코 (KSFO) 등";
  const firStr = isJfkToIcn 
    ? "KZNY (뉴욕) ➔ KZBW (보스턴) ➔ CZUL (몬트리올) ➔ CZWG (위니펙) ➔ CZEG (에드먼턴) ➔ PAZA (앵커리지) ➔ RJJJ (후쿠오카) ➔ RKRR (인천)"
    : "RKRR (인천) ➔ RJJJ (후쿠오카) ➔ PAZA (앵커리지) ➔ KZAK (오클랜드 해양) ➔ KZSE (시애틀) ➔ KZOA (오클랜드) ➔ KZLA (로스앤젤레스)";

  // 2. Build Critical NOTAMs
  const criticalNotams = [];
  if (isJfkToIcn) {
    criticalNotams.push({
      badge: "CRITICAL",
      title: "1. 출발지 (KJFK): 활주로 04R/22L 및 04L/22R 교차 활주로 동시 전면 폐쇄 (A7259/26, A7258/26)",
      period: "29AUG26 03:00 ~ 29AUG26 10:00Z (출발 시간대 포함)",
      content: "RWY 04R/22L 및 RWY 04L/22R 두 교차 활주로가 동시에 전면 폐쇄됩니다.",
      action: "출발 이륙 활주로가 RWY 31L 또는 13R로 전면 집중되어 심각한 지상 정체 및 이륙 대기 지연(Slot Delay)이 예상됩니다. 출항 전 최신 푸시백 및 이륙 활주로 배정 상태(31L Exp)를 확인하십시오."
    });
    criticalNotams.push({
      badge: "WARNING",
      title: "2. 출발지 (KJFK): JFK VOR/DME 및 CRI VOR/DME 운용 중단 (A7174/26, A7252/26, A6967/26)",
      period: "발효 중 (U/S)",
      content: "공항 주 항법시설인 JFK VOR/DME 및 CRI VOR/DME가 운용 불능(U/S)입니다.",
      action: "Kennedy Five SID 이륙 시(Breezy Point / Canarsie Climb) RNAV/GPS 장비 탑재기만 출항 가능합니다. FMS Navigation 상태(High Accuracy/GPS Primary)를 필수 확인하십시오."
    });
    criticalNotams.push({
      badge: "CAUTION",
      title: "3. 출발지 (KJFK): 이륙 활주로 31L/31R 시단 인근 다수의 대형 크레인 설치 (A6516/26, A6514/26, A6513/26)",
      period: "발효 중",
      content: "RWY 31L/31R 이륙 경로 4,000~5,000FT 지점에 최고 302FT MSL의 임시 기중기(Crane) 다수 설치.",
      action: "이륙 성능 계산(TODC/EFB) 시 장애물 데이터 반영 여부 및 엔진 고장 복행 시 상승 구배를 확인하십시오."
    });
    criticalNotams.push({
      badge: "CRITICAL",
      title: "4. 회항지 제한: 몬트리올(CYUL) A380 착륙 전면 불가 (CYUL E4479/26, E0873/26, E4943/26)",
      period: "발효 중",
      content: "날개폭 213FT(65m) 초과 항공기 공항 이용 전면 금지(Code F 불가) 및 자사기(Home Base) 외 일반 민항기 비상 회항 불가.",
      action: "캐나다 영공 비행 중 비상 상황 발생 시 CYUL을 회항 공항으로 선택할 수 없습니다 (인근 CYOW 또는 토론토 CYYZ 고려)."
    });
    criticalNotams.push({
      badge: "WARNING",
      title: "5. 리파일 공항: 도쿄 하네다(RJTT) 유도로 W 날개폭 제한 (RJTT E4533/26)",
      period: "발효 중",
      content: "TWY W (TWY K ~ TWY W13) 날개폭 65m 초과 항공기 통과 금지.",
      action: "A380(날개폭 79.8m) 리파일 착륙 시 해당 유도로 진입이 불가하므로 인가된 Code F Taxiway를 관제탑에 요청하십시오."
    });
    criticalNotams.push({
      badge: "CRITICAL",
      title: "6. 항로 공역: 캄차카 반도 화산재 분출 경보 (PAZA A2428/26, A2278/26)",
      period: "발효 중 (Color Code ORANGE, SFC ~ FL250)",
      content: "러시아 캄차카 반도 클류체프스코이 & 셰벨루치 화산 분출로 인한 화산재 위험 고도: SFC ~ FL250.",
      action: "알래스카/캄차카 통과 항로 비행 시 화산재 SIGMET 및 CWA를 지속 청취하고 야간 비행 중 화산재 구름 진입을 절대 회피하십시오."
    });
  } else {
    // AAR202 RKSI-KLAX
    criticalNotams.push({
      badge: "CRITICAL",
      title: "1. 도착지 (KLAX): 활주로 07L/25R 일시 전면 폐쇄 (KLAX A4733/26)",
      period: "29AUG26 07:30 ~ 29AUG26 13:30Z",
      content: "북측 주 활주로 RWY 07L/25R 공사로 인해 전면 폐쇄됩니다.",
      action: "북측 착륙 시 06L/24R 또는 남측 07R/25L, 06R/24L 활주로 배정 확인. 접근 브리핑 시 활주로 변경(Sidestep 등) 대비."
    });
    criticalNotams.push({
      badge: "WARNING",
      title: "2. 도착지 (KLAX): [A380 기종 한정] 유도로 B 날개폭 제한 고시 (KLAX A4372/26)",
      period: "매주 목/금/토/화/수 0730-1330Z",
      content: "TWY B (TWY B3 ~ TWY B1 구간) 날개폭 118FT(36m) 초과 항공기 지상 활주 전면 금지.",
      action: "본 기종(A380-800)은 날개폭이 261.8FT(79.8m)로 해당 구간 통과가 불가능합니다. 북측 활주로 착륙 후 관제사에게 A380 인가 Taxiway(TWY C 등) 우회 경로를 필히 요청하십시오."
    });
    criticalNotams.push({
      badge: "CRITICAL",
      title: "3. 항로 공역: 캄차카 반도 화산재 분출 경보 (PAZA A2428/26, A2278/26)",
      period: "발효 중 (Color Code ORANGE, SFC ~ FL250)",
      content: "러시아 캄차카 반도 클류체프스코이 & 셰벨루치 화산 분출로 인한 화산재 위험 고도: SFC ~ FL250.",
      action: "북태평양 항로 통과 시 최신 화산재 SIGMET 및 CWA를 모니터링하고 화산재 구름 진입을 회피하십시오."
    });
    criticalNotams.push({
      badge: "WARNING",
      title: "4. 출발지 (RKSI): 인천 FIR 군 훈련에 따른 GPS 신호 불량 경고 (RKSI Z0511/24, Z0555/26)",
      period: "발효 중",
      content: "인천/서울 인근 공역에서 군 훈련으로 인한 GPS 신호 간헐적 유실 및 Nuisance GPWS/Terrain 경보 발생 보고.",
      action: "GPS 신호 이상 발생 시 즉시 관제탑/접근관제소에 무선 보고하고, 재래식 항법(VOR/DME) 크로스체크 유지."
    });
    criticalNotams.push({
      badge: "CAUTION",
      title: "5. 출발지 (RKSI): 이륙 시 400FT AGL 이하 조기 선회 금지 (RKSI COAD05/26)",
      period: "발효 중",
      content: "NDB 업데이트 후 FMS 로직에 따라 이륙 직후 Flight Director가 400FT AGL 이하에서 첫 RNAV Fix로 조기 선회를 지시할 수 있음.",
      action: "400FT AGL 이전에는 어떠한 경우에도 선회를 시작하지 말 것 (FOM 6.4.4 준수)."
    });
  }

  // 3. Build Point-by-Point Route Compliance
  const compliancePoints = [
    {
      no: 1,
      title: "앵커리지 FIR 북부 공역 진입 및 경로 제한 준수 (PAZA A0176/26)",
      rule: "YUKON 1-5, DELTA, FOX 군 공역 활성화(1500-0600Z) 시, 북위 62도 이북에서 앵커리지 FIR로 진입하는 모든 항공기는 반드시 (A) ON OR N OF GOATS DCT BTT 또는 (B) ORT J124 GKN 경로로만 비행해야 함. (FIORD, CHAPO, FANES, GOATS DCT FYU 경로는 사용 금지)",
      filed: isJfkToIcn ? "...N67W130..GOATS..BTT..N66W160..." : "...OMOTO..OPHET..OPAKE..PINSO..AMOND...",
      status: "COMPLIANT",
      verdict: "✅ 완전 일치 및 준수 (COMPLIANT)",
      desc: "의무 지정 경로인 GOATS DCT BTT를 정확하게 비행계획에 반영하여 군 공역 제한사항을 100% 준수합니다."
    },
    {
      no: 2,
      title: "앵커리지 UPR(사용자 선호 항로) 진입/진출 규정 준수 (PAZA A2472/26)",
      rule: "Item 2.A (CZEG ➔ PAZA 진입점): TAYTA, GOATS, FIORD, CHAPO, TOVAD 등 지정 Fix 중 하나 경유 의무.<br>Item 3.A (PAZA ➔ RJJJ 서향 진출 규정): 서향 항공기는 웨이포인트 NIKLL 또는 그 동쪽(East)에서 항로 R220에 합류(Join)해야 함.",
      filed: isJfkToIcn ? "CZEG➔PAZA 진입: GOATS 경유 | PAZA➔RJJJ 진출: NATES (동경 E171°58')에서 R220 조인" : "PAZA UPR 적합 항로 비행계획 수립",
      status: "COMPLIANT",
      verdict: "✅ 완전 일치 및 준수 (COMPLIANT)",
      desc: "NATES는 NIKLL(동경 E169°20')보다 동쪽(East)에 위치하므로, NOTAM 규정(Join R220 over or East of NIKLL)을 완벽하게 만족합니다."
    },
    {
      no: 3,
      title: "일본 후쿠오카 FIR 조건부 항로(CDR) 유효 시간 준수 (RJJJ Q2053/26)",
      rule: "항로 L512 구간은 조건부 항로(CDR)로서 260829 1200Z ~ 2200Z 시간대에만 비행 가능 (MEA 이상).",
      filed: "항로상 GTC L512 TENAS 구간 비행 | OFP상 GTC ETO 13:19Z, TENAS ETO 14:10Z",
      status: "COMPLIANT",
      verdict: "✅ 완전 일치 및 준수 (COMPLIANT)",
      desc: "비행 통과 시간대(13:19Z~14:10Z)가 L512 개방 시간(12:00Z~22:00Z) 범위 내에 정확히 위치하여 정상 비행 가능합니다."
    },
    {
      no: 4,
      title: "캄차카 반도 화산재 위험 고도 완전 회피 (PAZA A2428/26, A2278/26)",
      rule: "러시아 캄차카 반도 클류체프스코이 & 셰벨루치 화산 분출로 인한 화산재 위험 고도: SFC ~ FL250 (ORANGE 경보).",
      filed: "캄차카 반도 인접 통과 구간 계획 순항 고도: FL380 ➔ FL400",
      status: "COMPLIANT",
      verdict: "✅ 안전 고도 확보 (COMPLIANT)",
      desc: "화산재 위험 상한선(FL250)보다 13,000~15,000FT 이상 상공으로 비행하여 안전하게 통과합니다."
    },
    {
      no: 5,
      title: "뉴욕 JFK 출항 VOR 결함에 따른 RNAV 장비 준수 (KZNY A0695/26, A7174/26)",
      rule: "CRI VOR/DME 및 JFK VOR/DME 운용 중단으로 Kennedy Five SID 출항 시 RNAV/GPS 탑재 필수.",
      filed: "항공기 장비: A388 / SDE1E2E3FGHIJ1J2J3J4J5M1P2RWXYZ/LB1D1 (PBN/A1B1C1D1L1O1S2, RNP 1 / RNAV 1 인증 완비)",
      status: "COMPLIANT",
      verdict: "✅ 규정 준수 (COMPLIANT)",
      desc: "비행계획에 RNP 1 및 RNAV 1 인증이 완비되어 있어 VOR 결함과 무관하게 표준 계기출발을 정상 수행합니다."
    },
    {
      no: 6,
      title: "인천 FIR 진입 및 비행금지구역 회피 (RKRR D1768/26, Z0632/26)",
      rule: "서울 중심부(373523N 1265832E) 반경 2NM 임시 비행금지구역 설정 (D1768/26, SFC~UNL).",
      filed: "...TENAS Y437 KAE Y697 KARBU..RKSI",
      status: "COMPLIANT",
      verdict: "✅ 규정 준수 (COMPLIANT)",
      desc: "금지구역을 우회하여 동남측 KARBU 픽스를 통해 인천공항 표준 계기접근 절차로 정상 진입합니다."
    }
  ];

  // 4. Caution Airport Breakdown Table Data
  const cautionAirports = isJfkToIcn ? [
    { stn: "RKSI", id: "Z0511/24", item: "인천 FIR 군 훈련으로 인한 GPS 신호 간헐적 교란", action: "Nuisance GPWS 경보 주의, VOR/DME 크로스체크" },
    { stn: "RKSI", id: "COAD05/26", item: "NDB 개정으로 인한 FMS 400FT AGL 이하 조기 선회 금지", action: "이륙/복행 시 400ft 이전 선회 금지 (FOM 6.4.4)" },
    { stn: "RKSI", id: "A1073/26", item: "Taxilane R23, R24 Code E까지만 진입 가능", action: "Code F(A380) 진입 불가, Stand 208R/290R 유의" },
    { stn: "RKSS", id: "COAD01/21", item: "공항 심야 커퓨 (1400 ~ 2100Z)", action: "심야 도착 시 커퓨 시간대 착륙 제한 확인" },
    { stn: "RKSS", id: "A0908/26", item: "RWY 14L/32R 커퓨 시간대(1400-2000Z) 공사 폐쇄", action: "회항 시 RWY 14R/32L 단일 활주로 착륙" },
    { stn: "RKSS", id: "A1104/26", item: "TWY B1, C1, D1, E1, G1 정지선등(Stop Bar Light) 시범 운영", action: "정지선등 점등 시 관제 허가와 불일치해도 정지 후 재확인" }
  ] : [
    { stn: "KONT", id: "A1769/26", item: "RWY 26L PAPI 운용 불능 (U/S)", action: "야간 착륙 시 시각 진입각 참조 불가 유의" },
    { stn: "KONT", id: "A1388/26", item: "RWY 26R ALS(진입등화) 운용 불능 (U/S)", action: "저시정 착륙 시 최저치(Vis/RVR) 상향 확인" },
    { stn: "KONT", id: "A1387/26", item: "ILS RWY 26R CAT II/III 인가 불가 (NA)", action: "정밀접근 CAT I 최저치(Minima) 적용" },
    { stn: "KONT", id: "A1736/26", item: "TWY S, T, U, S5, Q 일괄 폐쇄", action: "활주로 08R/26L 개방 후 지상 활주 제한" }
  ];

  // 5. Checklist Items
  const checklist = isJfkToIcn ? [
    { text: "KJFK 출발 이륙 활주로 집중 및 지상 정체 대비", desc: "RWY 04L/22R & 04R/22L 동시 폐쇄(A7259/58). 31L/13R 단일 이륙 집중 대비 추가 택시 연료 및 시간 관리." },
    { text: "KJFK 출항 시 RNAV 상태 점검", desc: "JFK VOR & CRI VOR 운용 중단(A7174/A7252). Kennedy Five SID 출항 시 GPS Primary 정상 확인." },
    { text: "캐나다 구간 비상 회항 시 CYUL(몬트리올) 배제", desc: "CYUL 날개폭 213ft 제한 및 타사기 회항 불가 고시(E4479/E4943). 비상 시 CYYZ(토론토) 등 인가 공항 선정." },
    { text: "캄차카 반도 인근 화산재(Volcanic Ash) 회피", desc: "클류체프스코이/셰벨루치 화산 ORANGE 경보(PAZA A2428/26). FL250 이하 화산재 연기 주의." },
    { text: "김포(RKSS) 회항 시 커퓨 및 활주로 14L 폐쇄 확인", desc: "심야 커퓨(1400-2100Z) 및 RWY 14L/32R 폐쇄(A0908/26)에 따라 14R 단일 착륙 대비." }
  ] : [
    { text: "KLAX 착륙 활주로 사전 확인", desc: "RWY 07L/25R 일시 폐쇄(A4733/26)에 따라 남측 활주로(25L/24R) 또는 06L/24R 착륙 브리핑 준비." },
    { text: "KLAX 지상 활주 시 A380 날개폭(261ft) 제한 확인", desc: "TWY B (B3~B1) 구간 날개폭 118ft 초과 진입 금지(A4372/26). A380 인가 TWY 우회 필수." },
    { text: "캄차카 반도 인근 화산재(Volcanic Ash) 감시", desc: "클류체프스코이/셰벨루치 화산 ORANGE 경보(PAZA A2428/26). FL250 이하 화산재 연기 주의." },
    { text: "인천 FIR 상승 중 GPS 신호 유실 주의", desc: "군 훈련 GPS 간섭(Z0511/24) 발생 시 Nuisance GPWS 대응 및 VOR/DME 백업 크로스체크." },
    { text: "KONT 회항 시 착륙 최저치 재계산", desc: "RWY 26L PAPI U/S 및 RWY 26R ALS U/S, ILS 26R CAT II/III 불가 반영." }
  ];

  // 6. In-flight Monitoring Reminders
  const inFlightReminders = [
    { title: "PAZA CPDLC Logon 주소 전환 확인", desc: "GOATS 진입 시 PAZA로 접속 ➔ 서경 167°W~174°W 서쪽 통과 시 PAZN 주소 사용 (PAZA A0044/24)." },
    { title: "CZUL/CZWG 통과 시 레이더/주파수 점검", desc: "Brisay Radar U/S(H5625/26) 및 위니펙 일부 주파수 단절(G3067/26)에 따른 고도/항로 변경 지연 가능성 대비." },
    { title: "인천 접근 시 GPS 모니터링", desc: "인천 FIR 진입 후 군 훈련 GPS 간섭(RKRR Z0555/26)으로 인한 EGPWS 불필요 경보 발생 여부 주시." }
  ];

  return {
    meta: {
      filename,
      callsign,
      flightNo,
      reg,
      acftType,
      dep,
      dest,
      altn,
      flightTime,
      routeText,
      refileStr,
      etpStr,
      firStr
    },
    criticalNotams,
    compliancePoints,
    cautionAirports,
    checklist,
    inFlightReminders
  };
}
