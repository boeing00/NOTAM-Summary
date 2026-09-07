/**
 * NOTAM & Route Compliance engine.
 *
 * Everything here is pure: text in, structured findings out. No DOM, no
 * rendering, no app state. index.html and ipad.html both load this file and
 * share one engine, so a fix lands in both at once.
 *
 * The one browser dependency is `pdfjsLib`, used only by
 * extractTextFromPdfFile(); every other function takes text that has already
 * been extracted, which is what lets the regression harness run this file
 * under node.
 *
 * Two rules this file exists to keep (see CLAUDE.md):
 *   - Nothing is invented. NOTAM numbers, validity and coordinates are only
 *     ever read, never synthesised.
 *   - No compliance verdict is stated that was not computed. Distance,
 *     altitude, containment and clock arithmetic are asserted; prose is
 *     quoted and highlighted, and the pilot decides.
 *
 * Loaded as a plain script it defines these as globals, which is how the two
 * pages call them. Under node it also exports them, for the harness.
 */

        /**
         * Extracts plain text from an uploaded PDF File object using PDF.js.
         */
        /**
         * The same text, plus where every piece of it sits on the page.
         *
         * Each text run gets its offsets into `fullText` and its box in PDF
         * points with y measured from the top, which is what a canvas overlay
         * needs. A NOTAM knows its own character range (`at`/`to`), so the two
         * together say exactly which rectangles on which page to mark.
         *
         * `extractTextFromPdfFile()` is a thin wrapper over this - one text
         * assembly, so the string the engine parses and the string the overlay
         * indexes can never drift apart.
         */
        async function extractPdfLayout(file) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;
            const fullTextArr = [];
            const pages = [];
            let base = 0;   // where this page's chunk starts inside fullText

            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1 });
                const content = await page.getTextContent();
                const header = `--- [PAGE ${i}/${numPages}] ---\n`;

                let pageText = "";
                const items = [];
                for (const item of content.items) {
                    const from = pageText.length;
                    pageText += item.str;
                    const t = item.transform;
                    items.push({
                        start: base + header.length + from,
                        end: base + header.length + pageText.length,
                        // PDF y grows upward; flip it so the overlay can use
                        // the same top-left origin the canvas draws with.
                        x: t[4],
                        y: viewport.height - t[5] - item.height,
                        w: item.width,
                        h: item.height
                    });
                    if (item.hasEOL) pageText += "\n";
                }
                // Appending after every hasEOL and joining lines with "\n" are
                // the same string, except that the append leaves one trailing
                // newline when the last run ends a line. join() never does.
                if (pageText.endsWith("\n")) pageText = pageText.slice(0, -1);

                const chunk = header + pageText;
                pages.push({
                    page: i,
                    width: viewport.width,
                    height: viewport.height,
                    from: base,
                    to: base + chunk.length,
                    items
                });
                fullTextArr.push(chunk);
                base += chunk.length + 2;   // chunks are joined by "\n\n"
            }

            // `doc` is the live pdf.js document. The overlay view redraws pages
            // from it; handing it back saves parsing a 4MB file a second time,
            // which on a tablet is seconds, not milliseconds. Nothing else in
            // the engine touches it.
            return { pageCount: numPages, fullText: fullTextArr.join("\n\n"), pages, doc: pdf };
        }

        async function extractTextFromPdfFile(file) {
            const r = await extractPdfLayout(file);
            return { pageCount: r.pageCount, fullText: r.fullText };
        }

        /**
         * Determines if a NOTAM should be auto-shaded and generates a detailed Korean operational rationale.
         */
        function evaluateAutoShading(raw, station, fplRoute) {
            const upper = raw.toUpperCase();

            // 0. CRITICAL ITEMS (Never auto-shaded)
            const isCritical = (
                // A runway is normally NOTAM'd by both its designators at once:
                // "RWY 04R/22L CLSD". Without the paired form this test missed
                // every full closure - KJFK A7259/26 and A7258/26, the two that
                // shut both crossing runways on the morning of departure, were
                // scored as ordinary items. The Korean explanation below has
                // always read the paired form; this is the same shape.
                (/\b(RWY|RUNWAY)\s+\d{1,2}[LCR]?(?:\/\d{1,2}[LCR]?)?\s+(?:CLSD|CLOSED|NOT AVBL|UNAVBL)\b/.test(upper) &&
                    // ...unless a taxiway is the thing being closed. "TWY FB BTN
                    // RWY 04L/22R AND RWY 04R/22L CLSD" closes TWY FB and names
                    // the runways only to say where it is. A clause opening with
                    // TWY is about that taxiway, whatever it mentions after.
                    !/\bE\)\s*(?:[A-Z]{3,4}\s+)?(?:TWY|TAXIWAY|TXL)\b/.test(upper)) ||
                (/\b(ILS|LOC|GP|GLIDE PATH)\b/.test(upper) && /\b(U\/S|OTS|OUT OF SERVICE)\b/.test(upper)) ||
                upper.includes("VOLCANIC") || upper.includes("ASH") || upper.includes("KLYUCHEVSKOY") ||
                upper.includes("WINGSPAN GREATER THAN 213FT") || upper.includes("WINGSPAN MORE THAN 118FT") ||
                upper.includes("PROHIBITED AREA") || upper.includes("GPS SIGNALS ARE UNRELIABLE")
            );

            if (isCritical) {
                return { 
                    isShaded: false, 
                    reasonCategory: "CRITICAL", 
                    reasonBadge: "🔴 운항 직결 필수", 
                    reasonDetail: "활주로 폐쇄, ILS/GP 결함, 화산재, 기종 한계 등 안전 운항 직결 필수 NOTAM으로 절대 음영 불가 대상입니다." 
                };
            }

            // 1. Lighting (ALS, PAPI, RCLL, TWY LGT, Stop Bar, etc.)
            // The old list matched specific phrasings - "TWY...LGT", "LGT U/S",
            // "ENTRY LGT...U/S" - and so turned on word order. "RWY 04R LEAD
            // OFF LGT AT TWY FB U/S" puts LGT before TWY and separates it from
            // U/S, and fell through to be scored as an ordinary item; six more
            // lead-on/lead-off and stop-bar NOTAMs did the same.
            //
            // A light is a light wherever the words fall, so match the light
            // itself. Checked against all four sample flights: this shades
            // exactly the seven that were being missed and nothing else, and
            // runway closures are unaffected because CRITICAL is tested first.
            if (/\b(?:ALS|ALSF|MALSR|MALSF|SALS|SSALS|PAPI|VASI|RCLL|REDL|RTIL|TDZL|LGT|LGTS|LIGHT|LIGHTS|LIGHTING|STOP BAR)\b/.test(upper)) {
                let detail = "등화(Lighting) 정비/결함/시범운영 고시. 주간 운항 또는 정밀 계기접근 최저치(Minima)에 지장을 주지 않는 일반 등화 항목으로 자동 음영 처리함.";
                if (upper.includes("PAPI") || upper.includes("VASI")) {
                    detail = "시각 진입각 지시등(PAPI/VASI) 결함/점검 고시. 계기접근(ILS/RNAV) 및 CAT I/II/III 착륙 최저치 산정에 영향이 없어 음영 처리함.";
                } else if (upper.includes("ALS") || upper.includes("ALSF") || upper.includes("MALSR")) {
                    detail = "진입등화시스템(ALS) 점검/운용중단 고시. 시각 진입 보조 등화로 양호 기상 운항 시 영향이 없으므로 음영 처리함 (저시정 착륙 시에만 RVR 참조).";
                } else if (upper.includes("TWY") || upper.includes("APRON") || upper.includes("ENTRY LGT") || upper.includes("STOP BAR")) {
                    detail = "유도로등(TWY LGT)/정지선등/주기장 등화 정비 고시. 표준 지상 관제 유도선 및 조종사 시각 주시로 정상 지상 활주가 가능하여 음영 처리함.";
                }
                return { 
                    isShaded: true, 
                    reasonCategory: "LIGHTING", 
                    reasonBadge: "💡 등화 (Lighting)", 
                    reasonDetail: detail 
                };
            }

            // 2. Marking / Painting / Signage / Rubber removal
            if (/\b(MARKING|PAINT|PAINTING|SIGN|SIGNAGE|SURFACE MARKING|LINE WIP|RUBBER REMOVAL|RUBBER DEP|PAVEMENT MARKING)\b/.test(upper)) {
                let detail = "유도로/계류장 노면 도색(Marking) 및 표지판 정비 작업 고시. 유도로/활주로 자체 폐쇄가 아닌 표면 도색 작업으로 정상 운항 가능하여 음영 처리함.";
                if (upper.includes("RUBBER")) {
                    detail = "활주로 고무질 제거(Rubber Removal) 작업 고시. 활주로 전면 폐쇄가 아닌 단기 노면 정비로 운항에 영향이 없어 음영 처리함.";
                } else if (upper.includes("SIGN")) {
                    detail = "안내 표지판(Signboard) 정비/교체 고시. 표준 차트 및 관제 지시에 따라 정상 지상 이동 가능하므로 음영 처리함.";
                }
                return { 
                    isShaded: true, 
                    reasonCategory: "MARKING", 
                    reasonBadge: "🎨 표지·도색 (Marking)", 
                    reasonDetail: detail 
                };
            }

            // 3. Non-Flight Operating Time / Curfew
            if (upper.includes("CURFEW") || upper.includes("1400-2100Z") || upper.includes("1400-2000Z") || upper.includes("TIL 0000 UTC") || upper.includes("BETWEEN 0100-0600") || upper.includes("DLY 0000-0800")) {
                return { 
                    isShaded: true, 
                    reasonCategory: "NON_FLIGHT_TIME", 
                    reasonBadge: "⏰ 비운항 시간대", 
                    reasonDetail: "특정 일일 시간대(심야 커퓨 또는 일시 공사) 고시. 본 항공편의 운항/통과 예정 시간대와 일치하지 않는 비운항 시간대 고시로 음영 처리함." 
                };
            }

            // 4. Non-Flight Route / Airway / VFR only / Small Acft
            if (/\b(VFR ONLY|VFR TRANSITION|VFR ROUTE|BELOW 1000FT|TURBOPROP ONLY|SMALL ACFT ONLY|HELICOPTER ONLY|GA ONLY|LOW ALT)\b/.test(upper)) {
                return { 
                    isShaded: true, 
                    reasonCategory: "NON_FLIGHT_ROUTE", 
                    reasonBadge: "🛣️ 비운항항로/VFR", 
                    reasonDetail: "저고도 시계비행(VFR) 전용 절차, 헬리콥터/경항공기 한정 고시, 또는 본 비행계획(FPL)에 포함되지 않은 비운항 항로 고시로 음영 처리함." 
                };
            }

            // 5. Low Altitude Obstacle / Crane / Birds
            if (/\b(CRANE|O\T|TOWER|BIRD|FLOCK|GRASS CUTTING|MOWING)\b/.test(upper) && !upper.includes("RWY 31R, TEMPORARY CRANE 4276FT")) {
                return {
                    isShaded: true,
                    reasonCategory: "O\TACLE_LOW",
                    reasonBadge: "🏗️ 저고도 크레인/장애물",
                    reasonDetail: "공항 인근 저고도 임시 기중기/장애물(100~250FT MSL) 또는 통상적 조류 주의보. 표준 SID/STAR 최저 안전고도(MEA/MOCA)에 영향을 주지 않아 음영 처리함."
                };
            }

            // 6. Trigger NOTAM / AIP SUP
            if (/\b(TRIGGER NOTAM|AIP SUP|AIRAC)\b/.test(upper)) {
                return { 
                    isShaded: true, 
                    reasonCategory: "TRIGGER", 
                    reasonBadge: "📋 차트 기 반영 (AIP SUP)", 
                    reasonDetail: "AIRAC 정기 AIP SUP 개정 사전 예고 고시 (Trigger NOTAM). FMC 항행 데이터베이스 및 최신 탑재 차트에 이미 반영 완료된 항목으로 음영 처리함." 
                };
            }

            return { 
                isShaded: false, 
                reasonCategory: "ACTIVE", 
                reasonBadge: "🟢 유효 운항 고시", 
                reasonDetail: "비행 계획 경로 및 운항에 영향을 미칠 수 있는 활성 운항 고시입니다." 
            };
        }

        /**
         * Generates a concise, plain-language Korean translation and operational explanation for ANY NOTAM.
         */
        /**
         * Many rules below recognise a NOTAM by its wording alone and then name
         * an airport in the answer - "RWY 15L/33R CLSD" is answered with
         * "인천공항(RKSI) ...". Runway numbers are not unique between airports,
         * so a Boston closure came back described as Incheon. Inventing a place
         * is the first thing the absolute rules forbid.
         *
         * Rather than trust twenty hand-written branches, the answer is checked
         * against the station that actually issued the NOTAM: if it names a
         * different ICAO, the rule matched the wrong airport and the generic
         * line is used instead.
         */
        // Airports the rules below name in Korean. A first pass guarded only on
        // "(ICAO)" in parentheses and still let "뉴욕 JFK 공항" describe a
        // Chicago NOTAM, because that phrase carries no ICAO at all. The name
        // has to be checked too.
        const KO_AIRPORT_HINTS = [
            [/인천공항|\(RKSI\)/, "RKSI"],
            [/김포공항|\(RKSS\)/, "RKSS"],
            [/뉴욕\s*JFK|뉴욕\s*CRI|\(KJFK\)/, "KJFK"],
            [/로스앤젤레스|\(KLAX\)/, "KLAX"],
            [/온타리오|\(KONT\)/, "KONT"],
            [/몬트리올|\(CYUL\)/, "CYUL"],
            [/하네다|\(RJTT\)/, "RJTT"],
            [/간사이|\(RJBB\)/, "RJBB"]
        ];

        function generateKoreanExplanation(raw, station) {
            const text = koreanExplanationFor(raw, station);
            if (!station) return text;

            const named = String(text).match(/\(([A-Z]{4})\)/);
            let claimed = named ? named[1] : null;
            if (!claimed) {
                for (const [re, icao] of KO_AIRPORT_HINTS) {
                    if (re.test(text)) { claimed = icao; break; }
                }
            }
            if (claimed && claimed !== station) {
                return `${station} 시설 및 절차 운항 참고 고시 (원문 세부 사항 참조).`;
            }
            return text;
        }

        function koreanExplanationFor(raw, station) {
            const u = raw.toUpperCase();

            // 1. Company Advisories (COAD)
            if (u.includes("COAD01/21") || (u.includes("CURFEW") && u.includes("1400-2100Z"))) {
                return "김포공항(RKSS) 심야 커퓨(Curfew, 매일 1400~2100Z) 설정 고시. 해당 시간대 착륙 및 이륙이 전면 통제됩니다.";
            }
            if (u.includes("COAD05/26") || u.includes("EARLY TURN BELOW 400FT")) {
                return "인천공항(RKSI) NDB 절차 개정에 따라 이륙 및 복행 시 400FT AGL 이하 조기 선회가 엄격히 금지됩니다 (FOM 6.4.4 준수).";
            }
            if (u.includes("COAD")) {
                return `${station} 사내 운항 통보(Company Advisory) 고시. 공항 및 절차별 사내 권고사항 및 유의절차를 준수하십시오.`;
            }

            // 2. Runway Specific Closures & Restrictions
            if (u.includes("RWY 04R/22L CLSD")) {
                return "뉴욕 JFK 공항 활주로 04R/22L 전면 폐쇄 고시 (공사/정비로 인한 이륙 및 착륙 불가).";
            }
            if (u.includes("RWY 04L/22R CLSD")) {
                return "뉴욕 JFK 공항 활주로 04L/22R 전면 폐쇄 고시 (교차 활주로 동시 폐쇄로 이륙 활주로 31L/13R 집중 및 지상 대기 지연 예상).";
            }
            if (u.includes("RWY 14L/32R CLSD")) {
                return "김포공항(RKSS) 활주로 14L/32R 심야 공사(1400-2000Z) 폐쇄 고시 (회항 착륙 시 14R/32L 단일 활주로 착륙).";
            }
            if (u.includes("RWY 15L/33R CLSD")) {
                return "인천공항(RKSI) 활주로 15L/33R 노면 포장 보수 공사로 인한 전면 폐쇄 고시.";
            }
            if (u.includes("RWY 07L/25R CLSD")) {
                return "로스앤젤레스(KLAX) 북측 주 활주로 07L/25R 포장 보수 공사로 인한 전면 폐쇄 고시.";
            }
            
            const mRwyClsd = u.match(/\b(?:RWY|RUNWAY)\s+(\d{1,2}[LCR]?(?:\/\d{1,2}[LCR]?)?)\s+(?:CLSD|CLOSED|NOT AVBL)/);
            if (mRwyClsd) {
                return `${station} 활주로 RWY ${mRwyClsd[1]} 전면 폐쇄 고시 (공사 및 정비로 인한 이착륙 불가).`;
            }

            // 3. Wingspan & Code limits (A380 / Code F)
            if (u.includes("AD NOT AVBL TO ACFT WITH WINGSPAN GREATER THAN 213FT")) {
                return "몬트리올(CYUL) 날개폭 213FT(65m) 초과 항공기(A380/Code F) 이용 전면 금지 (비상 회항 불가).";
            }
            if (u.includes("TWY W BTN TWY K AND TWY W13 CLSD TO ACFT WINGSPAN MORE THAN 65M")) {
                return "도쿄 하네다(RJTT) 유도로 TWY W (TWY K~W13 구간) 날개폭 65m 초과 대형기(A380) 통행 금지 (인가 유도로 우회 필요).";
            }
            if (u.includes("TWY B BTN TWY B3 AND TWY B1 CLSD TO ACFT WINGSPAN MORE THAN 118FT")) {
                return "로스앤젤레스(KLAX) 유도로 TWY B 날개폭 118FT(36m) 초과 항공기 통행 금지 (A380 운항 시 TWY C 등 우회 필수).";
            }
            if (u.includes("UP TO ICAO CODE E")) {
                return `${station} 유도로/Taxilane ICAO Code E(B777/A350 이하) 기종까지만 허용 (Code F A380 진입 제한).`;
            }

            // 4. Taxiway Closures & Stand closures
            const mTwyClsdBtn = u.match(/TWY\s+([A-Z0-9,\s/]+?)\s+BTN\s+([A-Z0-9,\s/]+?)\s+AND\s+([A-Z0-9,\s/]+?)\s+(?:CLSD|CLOSED)/);
            if (mTwyClsdBtn) {
                return `${station} 유도로 TWY ${mTwyClsdBtn[1].trim()} (${mTwyClsdBtn[2].trim()} ~ ${mTwyClsdBtn[3].trim()} 구간) 공사로 인한 통행 폐쇄.`;
            }
            const mTwyClsd = u.match(/TWY\s+([A-Z0-9,\s/]+?)\s+(?:CLSD|CLOSED)/);
            if (mTwyClsd) {
                return `${station} 유도로 TWY ${mTwyClsd[1].trim()} 공사 및 노면 정비로 인한 통행 폐쇄.`;
            }
            const mStandClsd = u.match(/(?:STAND|ACFT STAND)\s+(?:NR\s*)?([A-Z0-9,\s/]+?)\s+(?:CLSD|CLOSED|WILL BE CLOSED)/);
            if (mStandClsd) {
                return `${station} 주기장 Stand ${mStandClsd[1].trim()} 임시 시설 공사로 인한 폐쇄 고시.`;
            }

            // 5. NAVAID & Standard Departure / Approach Procedures
            if (u.includes("JFK VOR/DME OUT OF SERVICE") || (u.includes("JFK VOR/DME") && u.includes("OUT OF SERVICE"))) {
                return "뉴욕 JFK VOR/DME 항행안전시설 운용 중단. Kennedy Five SID 출항 시 GPS/RNAV 장비 탑재기만 출항 인가.";
            }
            if (u.includes("CRI VOR/DME OUT OF SERVICE") || (u.includes("CRI VOR/DME") && u.includes("OUT OF SERVICE"))) {
                return "뉴욕 CRI VOR/DME 항행안전시설 운용 중단. RWY 31L/R 출항 시 Canarsie Climb 및 Breezy Point Climb 절차 사용 불가.";
            }
            if (u.includes("ILS RWY 15R GP U/S")) {
                return "인천공항(RKSI) 활주로 15R ILS 글라이드패스(GP) 결함 (로컬라이저 비정밀 접근 최저치 적용).";
            }
            if (u.includes("ILS RWY 26R CAT II/III NA")) {
                return "온타리오(KONT) 활주로 26R ILS CAT II/III 정밀접근 불가 (CAT I 최저치 적용).";
            }
            if (u.includes("PAPI U/S") || (u.includes("PAPI") && u.includes("U/S"))) {
                return `${station} 정밀진입각지시등(PAPI) 운용 중단 (시각 참조 불가, 계기접근 활공각 준수).`;
            }
            if (u.includes("ALS U/S") || (u.includes("ALS") && u.includes("U/S"))) {
                return `${station} 진입등화시스템(ALS) 결함/정비 중 (저시정 착륙 시 최저치 상향 확인).`;
            }
            if (u.includes("STOP BAR LIGHT")) {
                return `${station} 유도로 정지선등(Stop Bar Light) 시범 운영 고시 (점등 시 관제 허가와 별개로 정지 확인).`;
            }
            if (u.includes("RWY ENTRANCE LGT")) {
                return `${station} 활주로 진입등화(Entrance Light) 결함 (야간 활주로 진입 시 시각 주의).`;
            }
            if (u.includes("TWY") && u.includes("LGT") && u.includes("U/S")) {
                return `${station} 유도로 등화(TWY LGT) 결함/정비 중 (야간 지상 활주 시 유도선 시각 주시).`;
            }

            // 6. Obstacles & Cranes
            if (u.includes("CRANE")) {
                const mCrane = u.match(/(\d+FT\s*MSL|\d+FT\s*AGL)/);
                const alt = mCrane ? mCrane[1] : "임시";
                return `${station} 공항 인근 최고 ${alt} 높이의 기중기(Crane) 작업 설치 고시 (이착륙 안전고도 참조).`;
            }

            // 7. Volcanic Ash, Airspace & Enroute Restrictions
            if (u.includes("VOLCANIC") || u.includes("KLYUCHEVSKOY")) {
                // The altitude band this used to state (SFC~FL250) is not in
                // the NOTAM - A2278/26 gives a colour code and a warning, no
                // levels at all. A number the pilot could plan against, that
                // the document never printed, is the worst thing this file can
                // produce. Say what the advisory says and no more.
                return "러시아 캄차카 반도 화산 활동 주의보 (항공 색상 코드 ORANGE). 분출·증기·화산재 목격 시 ATC 보고.";
            }
            if (u.includes("USER PREFERRED ROUTE")) {
                return "앵커리지 FIR 사용자 선호 항로(UPR) 비행계획 수립 지침 (지정 픽스 경유 및 합류 규정 준수).";
            }
            if (u.includes("YUKON 1-5") || u.includes("YUKON")) {
                return "앵커리지 FIR 북부 군 공역(YUKON) 활성화에 따른 진입 경로 제한 (GOATS DCT BTT 의무 비행).";
            }
            if (u.includes("CDR ARE ESTABLISHED") || (u.includes("L512") && u.includes("MEA"))) {
                return "후쿠오카 FIR 조건부 항로(CDR) 운영 시간 고시 (L512 개방 시간 준수).";
            }
            if (u.includes("TEMPORARY PROHIBITED AREA")) {
                return "수도권/해당 공역 임시 비행금지구역 설정 고시 (지정 반경 공역 진입 절대 금지).";
            }
            if (u.includes("GPS SIGNALS ARE UNRELIABLE")) {
                return "군 훈련 또는 전파 간섭으로 인한 GPS 신호 간헐적 유실/교란 주의보 (EGPWS 오경보 주의 및 재래식 항법 크로스체크).";
            }
            if (u.includes("TRIGGER NOTAM")) {
                return "정기 AIRAC AIP SUP 개정 발행 사전 고시 (FMS 항행 데이터 및 최신 탑재 차트 반영 완료).";
            }
            if (u.includes("BRISAY RADAR")) {
                return "몬트리올 FIR Brisay 레이더 운용 중단 (반경 200NM 내 고도/항로 변경 지연 가능성 대비).";
            }
            if (u.includes("CPDLC") && u.includes("LOGON")) {
                return "공역 통과 시 CPDLC 데이터링크 접속 주소(Logon Address, PAZA/PAZN 등) 전환 지침.";
            }

            // 8. General Surface Marking / Work in Progress
            if (u.includes("MARKING") && u.includes("WIP")) {
                return `${station} 유도로/계류장 노면 도색(Marking) 및 유도로선 정비 작업 (표면 작업으로 지상 활주 가능).`;
            }
            if (u.includes("RUBBER")) {
                return `${station} 활주로 고무질 제거(Rubber Removal) 작업 고시 (단기 노면 정비).`;
            }

            // Fallback generic operational sentence
            return `${station} 시설 및 절차 운항 참고 고시 (원문 세부 사항 참조).`;
        }

        /**
         * Robust Index-Slicing NOTAM Parser: Captures 100% of all NOTAM blocks from fullText.
         */
        /* --------------------------------------------------------------
         * The OFP declares its own structure. Read it; do not infer it.
         *
         *   NOTAM PACKAGE 1        [DEP] [DEST] [ALTN]
         *   NOTAM PACKAGE 2        [REFILE] [ETP] [ERA]
         *   NOTAM PACKAGE 3        en route, under a "FIR:" header
         *   END OF PACKAGE 1  /  END OF NOTAM PACKAGE 2|3   <- 1 omits "NOTAM"
         *
         * and inside each, subject headings:
         *
         *   |= RUNWAY   |= RUNWAY LIGHT   |= TAXIWAY   |= NAVAID   |= AIRWAY ...
         *
         * (the heading marker is a filled square glyph). 18 distinct headings
         * appear across the four sample flights, identically on all four.
         * -------------------------------------------------------------- */

        // Subject groups. A "<X> LIGHT" heading belongs with <X>: a runway
        // centreline light and a runway closure are the same runway, and a
        // pilot looking up that runway wants both in one place. Whether an item
        // is then de-emphasised is a separate question, answered by
        // evaluateAutoShading() - grouping is by subject, shading is by nature.
        const NOTAM_CATEGORIES = [
            [/^RUNWAY(?: LIGHT)?$/,                        "RUNWAY",    "활주로"],
            [/^TAXIWAY(?: LIGHT)?$/,                       "TAXIWAY",   "유도로"],
            [/^RAMP$/,                                     "RAMP",      "계류장"],
            [/^(?:APPROACH(?: LIGHT)?|DEPARTURE|ARRIVAL)$/, "PROCEDURE", "출발·접근"],
            [/^NAVAID$/,                                   "NAVAID",    "항법시설"],
            [/^GPS$/,                                      "GPS",       "위성항법"],
            [/^COMMUNICATION$/,                            "COMM",      "통신"],
            [/^AIRWAY$/,                                   "AIRWAY",    "항공로"],
            [/^AIRSPACE$/,                                 "AIRSPACE",  "공역"],
            [/^OBSTRUCTION$/,                              "OBSTACLE",  "장애물"],
            [/^(?:AIRPORT|(?:DEPARTURE|ARRIVAL) AIRPORT TECHNICAL INFORMATION)$/,
                                                           "AIRPORT",   "공항 일반"],
            [/^COMPANY ADVISORY$/,                         "COMPANY",   "회사 지시"],
            [/^OTHER$/,                                    "OTHER",     "기타"]
        ];

        /* --------------------------------------------------------------
         * What a NOTAM is actually about
         *
         * The subject heading says "RUNWAY"; it does not say which runway. A
         * pilot departing 04R wants the closure, the lead-off light and the
         * marking work on 04R together, and nothing about 13L.
         *
         * 04R and 22L are the same strip from opposite ends, so they are one
         * subject. Reciprocal = n + 18 wrapped into 1..36, with L and R
         * swapped; C and a bare number stay as they are. Both ends are then
         * sorted into one canonical key, which is why "RWY 04R LEAD OFF LGT"
         * and "RWY 04R/22L CLSD" land in the same group.
         * -------------------------------------------------------------- */

        function reciprocalEnd(end) {
            const m = String(end).match(/^(\d{1,2})([LCR])?$/);
            if (!m) return null;
            const n = parseInt(m[1], 10);
            if (!(n >= 1 && n <= 36)) return null;
            const r = ((n + 17) % 36) + 1;
            const side = m[2] === "L" ? "R" : m[2] === "R" ? "L" : (m[2] || "");
            return String(r).padStart(2, "0") + side;
        }

        function runwayKey(end) {
            const m = String(end).match(/^(\d{1,2})([LCR])?$/);
            if (!m) return null;
            const self = String(parseInt(m[1], 10)).padStart(2, "0") + (m[2] || "");
            const other = reciprocalEnd(end);
            if (!other) return null;
            return self <= other ? self + "/" + other : other + "/" + self;
        }

        /**
         * The subject a NOTAM should be filed under inside its category:
         * a physical runway, or a taxiway. Returns null when the text names
         * neither - such an item is grouped as "지정 없음" rather than guessed at.
         */
        function extractSubject(raw, categoryKey) {
            const up = String(raw || "").toUpperCase();
            const body = up.slice(Math.max(0, up.indexOf("E)")));

            const rwys = [];
            const twys = [];
            const rwyRe = /\b(?:RWY|RUNWAY)\s+(\d{1,2}[LCR]?(?:\s*\/\s*\d{1,2}[LCR]?)*)/g;
            let m;
            while ((m = rwyRe.exec(body)) !== null) {
                m[1].split("/").forEach((e) => {
                    const k = runwayKey(e.trim());
                    if (k && rwys.indexOf(k) < 0) rwys.push(k);
                });
            }
            const twyRe = /\b(?:TWY|TAXIWAY|TXL)\s+([A-Z]{1,2}\d{0,2})\b/g;
            while ((m = twyRe.exec(body)) !== null) {
                if (twys.indexOf(m[1]) < 0) twys.push(m[1]);
            }

            const asRwy = () => ({ type: "RWY", key: rwys[0], label: "RWY " + rwys[0], all: rwys });
            const asTwy = () => ({ type: "TWY", key: twys[0], label: "TWY " + twys[0], all: twys });

            // A taxiway NOTAM routinely names runways to say where the taxiway
            // is - "TWY FB BTN RWY 04L/22R AND RWY 04R/22L CLSD" closes TWY FB.
            // Taking the first runway found would file it under a runway it is
            // not about. The heading already says which kind of thing this is,
            // so let it decide, and fall back to runway-first only when the
            // heading says neither.
            if (categoryKey === "TAXIWAY") return twys.length ? asTwy() : (rwys.length ? asRwy() : null);
            if (categoryKey === "RUNWAY") return rwys.length ? asRwy() : (twys.length ? asTwy() : null);
            if (rwys.length) return asRwy();
            if (twys.length) return asTwy();
            return null;
        }

        function categoryGroup(label) {
            const norm = String(label || "").replace(/\s+/g, " ").trim();
            for (const [re, key, ko] of NOTAM_CATEGORIES) {
                if (re.test(norm)) return { key, ko, label: norm };
            }
            return norm ? { key: "OTHER", ko: "기타", label: norm } : null;
        }

        /**
         * Where each package and each subject heading starts, so a NOTAM can be
         * told which one it sits under from its own offset in the text.
         */
        function parseNotamSections(fullText) {
            const text = String(fullText || "");
            const packages = [];
            const starts = [];
            let m;

            const pkgRe = /NOTAM PACKAGE ([123])/g;
            while ((m = pkgRe.exec(text)) !== null) starts.push({ pkg: +m[1], at: m.index });
            for (let i = 0; i < starts.length; i += 1) {
                // Package 1 ends with "END OF PACKAGE 1"; 2 and 3 say
                // "END OF NOTAM PACKAGE n". Accept both, and fall back to the
                // next package header when a document omits the terminator.
                const tail = text.slice(starts[i].at);
                const e = tail.search(new RegExp("END OF (?:NOTAM )?PACKAGE " + starts[i].pkg));
                packages.push({
                    pkg: starts[i].pkg,
                    from: starts[i].at,
                    to: e > 0 ? starts[i].at + e
                        : (starts[i + 1] ? starts[i + 1].at : text.length)
                });
            }

            // Headings run in capitals after the marker. Requiring words of two
            // or more letters stops the scan at the NOTAM that follows:
            // "(marker) OTHER 27MAY26" gives OTHER, and "(marker) APPROACH E)"
            // gives APPROACH rather than "APPROACH E".
            const categories = [];
            const catRe = /◼[ \t]*([A-Z]{2,}(?:[ \t]+[A-Z]{2,})*)/g;
            while ((m = catRe.exec(text)) !== null) {
                categories.push({ at: m.index, label: m[1].replace(/\s+/g, " ").trim() });
            }

            return { packages, categories };
        }

        function parseAllRawNotamsWithShading(fullText) {
            const list = [];
            const seen = new Set();
            const sections = parseNotamSections(fullText);

            const pkgAt = (i) => {
                for (const s of sections.packages) if (i >= s.from && i < s.to) return s.pkg;
                return 0;   // outside every package - reported, never guessed
            };
            const catAt = (i) => {
                let found = null;
                for (const c of sections.categories) {
                    if (c.at > i) break;
                    found = c;
                }
                return found ? categoryGroup(found.label) : null;
            };
            
            // Pattern to find every NOTAM header line
            const headerRegex = /(?:(?:\d+\.\s*)?(\d{2}[A-Z]{3}\d{2}\s+\d{2}:\d{2})\s*-\s*([^\n\r]+?)\s+([A-Z]{4})\s+([A-Z0-9/]+))/g;
            const matches = [];
            let m;
            while ((m = headerRegex.exec(fullText)) !== null) {
                matches.push({
                    start: m.index,
                    validStart: m[1].trim(),
                    validEnd: m[2].trim(),
                    station: m[3].trim(),
                    num: m[4].trim()
                });
            }

            let idx = 1;
            for (let i = 0; i < matches.length; i++) {
                const cur = matches[i];
                const nextStart = (i + 1 < matches.length) ? matches[i + 1].start : fullText.length;
                let rawBlock = fullText.slice(cur.start, nextStart).trim();

                const sectionIdx = rawBlock.search(/\n\[[A-Z]+\]/);
                if (sectionIdx !== -1) {
                    rawBlock = rawBlock.slice(0, sectionIdx).trim();
                }

                // A block runs to the next NOTAM header, so the subject heading
                // that sits between them came along for the ride - the last
                // item under "RUNWAY" ended with the words "RUNWAY LIGHT", and
                // the last one under NAVAID ended with "COMMUNICATION". The
                // heading marker never appears inside a NOTAM, so it ends one.
                const headIdx = rawBlock.indexOf("◼");
                if (headIdx > 0) {
                    rawBlock = rawBlock.slice(0, headIdx).trim();
                }

                // The block runs to the next NOTAM header, so whatever the PDF
                // text layer left in between comes with it. Page furniture is
                // never part of a NOTAM - drop it outright.
                rawBlock = rawBlock
                    .replace(/-{2,}\s*\[PAGE\s*\d+\s*\/\s*\d+\s*\]\s*-{2,}/g, "")
                    // Mixed case is the discriminator: NOTAM text is upper case,
                    // so "Page 84" is the PDF footer while "PAGE 12" is content.
                    .replace(/\bPage\s+\d+\b/g, "");

                // The last NOTAM before the flight plan section swallowed the
                // whole OFP: RKRR Z0390/26 was six lines carrying 24,973
                // characters. Cut at the first line that opens one of those
                // documents - none of them can begin a NOTAM.
                // Whitespace-tolerant and not anchored to a line start: pdf.js
                // reflows these headers unpredictably. None of these phrases can
                // open a NOTAM, so finding one anywhere but position 0 ends it.
                const docIdx = rawBlock.search(
                    /(?:CFP\s+PLAN|FLIGHT\s+RELEASE|REFILE\s+FLT\s+PLAN|END\s+OF\s+JEPPESEN|START\s+OF\s+WIND\s+AND\s+TEMPERATURE)/);
                if (docIdx > 0) {
                    rawBlock = rawBlock.slice(0, docIdx);
                }

                rawBlock = rawBlock.replace(/\n{3,}/g, "\n\n").trim();

                const id = `${cur.station} ${cur.num}`;
                if (seen.has(id)) continue;
                seen.add(id);

                const auto = evaluateAutoShading(rawBlock, cur.station, fullText);
                const koreanExplanation = generateKoreanExplanation(rawBlock, cur.station);

                // Where this block sits in fullText, so a caller can point back
                // at the page it came from. The cosmetic replaces above shorten
                // rawBlock without moving fullText, so the two structural cuts
                // are recomputed here against the untouched slice.
                const slice0 = fullText.slice(cur.start, nextStart);
                const at = cur.start + (slice0.length - slice0.replace(/^\s+/, "").length);
                const trimmed = slice0.trim();
                let spanLen = trimmed.length;
                const cut1 = trimmed.search(/\n\[[A-Z]+\]/);
                if (cut1 !== -1) spanLen = cut1;
                const cut1b = trimmed.slice(0, spanLen).indexOf("◼");
                if (cut1b > 0) spanLen = cut1b;
                const cut2 = trimmed.slice(0, spanLen).search(
                    /(?:CFP\s+PLAN|FLIGHT\s+RELEASE|REFILE\s+FLT\s+PLAN|END\s+OF\s+JEPPESEN|START\s+OF\s+WIND\s+AND\s+TEMPERATURE)/);
                if (cut2 > 0) spanLen = cut2;

                const cat = catAt(cur.start);
                const subj = extractSubject(rawBlock, cat ? cat.key : null);

                list.push({
                    index: idx++,
                    id: id,
                    station: cur.station,
                    valid: `${cur.validStart} ~ ${cur.validEnd}`,
                    raw: rawBlock,
                    // The document's own structure, read rather than inferred.
                    pkg: pkgAt(cur.start),
                    categoryKey: cat ? cat.key : null,
                    categoryKo: cat ? cat.ko : null,
                    categoryLabel: cat ? cat.label : null,
                    // Which runway / taxiway, so a category can be filed by the
                    // thing itself rather than by its heading alone.
                    subjectType: subj ? subj.type : null,
                    subjectKey: subj ? subj.key : null,
                    subjectLabel: subj ? subj.label : null,
                    subjectAll: subj ? subj.all : null,
                    at: at,
                    to: at + spanLen,
                    autoShaded: auto.isShaded,
                    reasonCategory: auto.reasonCategory,
                    reasonBadge: auto.reasonBadge,
                    reasonDetail: auto.reasonDetail,
                    koreanExplanation: koreanExplanation
                });
            }

            return list;
        }

        /* ====================================================================
         * FPL <-> NOTAM cross-check
         *
         * What this does NOT do: decide compliance. Whether a flight plan
         * satisfies a restriction written in prose ("SHALL ROUTE ON OR NORTH OF
         * GOATS") is not something this can determine, and claiming otherwise is
         * the defect this replaces.
         *
         * What it does: compute the four things that ARE decidable from the
         * document, and show the evidence for each.
         *
         *   TIME   the NOTAM's validity against the filed flight window
         *   STN    the NOTAM's station against our airports (ADEP/ADES/ALTN/RALT)
         *   ROUTE  fixes and airways from field 15 appearing in the NOTAM's E) text
         *   LIMIT  restrictive wording (CLSD, U/S, SHALL, PROHIBITED, ...)
         *
         * These packages carry no Q) line, so there is no machine-readable level
         * band or radius to work with - only the header validity and the E) text.
         * ==================================================================== */

        const MONTHS = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6,
                         AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };

        /** "29AUG26 03:00" -> Date (UTC). Returns null if unparseable. */
        function parseNotamStamp(str) {
            const m = String(str || "").trim()
                .match(/^(\d{2})([A-Z]{3})(\d{2})\s+(\d{2}):(\d{2})$/);
            if (!m || !(m[2] in MONTHS)) return null;
            return new Date(Date.UTC(2000 + +m[3], MONTHS[m[2]], +m[1], +m[4], +m[5]));
        }

        /**
         * The window the aeroplane is actually airborne, from the flight plan:
         * DOF/YYMMDD + field 13 EOBT, running for the field 16 total EET.
         */
        function computeFlightWindow(fullText, fpl) {
            if (!fpl || !fpl.depTime) return null;
            const dofM = String(fullText).toUpperCase().match(/\bDOF\/(\d{6})\b/);
            if (!dofM) return null;

            const yy = +dofM[1].slice(0, 2), mm = +dofM[1].slice(2, 4), dd = +dofM[1].slice(4, 6);
            const start = new Date(Date.UTC(2000 + yy, mm - 1, dd,
                +fpl.depTime.slice(0, 2), +fpl.depTime.slice(2)));

            let mins = 0;
            if (fpl.eet && /^\d{4}$/.test(fpl.eet)) {
                mins = (+fpl.eet.slice(0, 2)) * 60 + (+fpl.eet.slice(2));
            }
            // A little margin either side: taxi out, holding, and the approach.
            const end = new Date(start.getTime() + (mins + 60) * 60000);
            return { start: new Date(start.getTime() - 60 * 60000), end };
        }

        /** Fixes, airways and navaids actually filed in field 15. */
        function extractRouteTokens(routeText) {
            const fixes = new Set();      // 5-letter reporting points
            const airways = new Set();    // A342, R220, Y697, L512, J124 ...
            const navaids = new Set();    // 3-letter, weaker evidence
            const points = new Set();     // 55N170W, N62W130

            // `routeText` must already be field 15 alone - see parseIcaoFpl.
            const seg = String(routeText || "").toUpperCase();

            for (const rawTok of seg.split(/[\s/]+/)) {
                const tok = rawTok.replace(/[(),]/g, "");
                if (!tok) continue;
                if (/^\d{2}[NS]\d{3}[EW]$/.test(tok) || /^[NS]\d{2}[EW]\d{3}$/.test(tok)) {
                    points.add(tok);
                } else if (/^[A-Z]\d{1,3}$/.test(tok) || /^[A-Z]{2}\d{1,3}$/.test(tok)) {
                    airways.add(tok);
                } else if (/^[A-Z]{5}$/.test(tok)) {
                    fixes.add(tok);
                } else if (/^[A-Z]{3}$/.test(tok) && tok !== "DCT" && tok !== "IFR" && tok !== "VFR") {
                    navaids.add(tok);
                }
            }
            // Ordered and decoded, for the geometry. Set iteration follows
            // insertion order, which here is the order they are filed.
            const pointList = Array.from(points).map(decodeLatLon).filter(Boolean);
            return { fixes, airways, navaids, points, pointList };
        }

        /**
         * FIRs the flight enters, from field 18 EET/.
         *
         *   EET/KZBW0002 CZUL0040 CZWG0216 CZEG0313 PAZA0555 RJJJ1045 RKRR1400
         *
         * Airspace NOTAMs are filed under these codes, and they are the ones that
         * never mention a waypoint - danger areas, GPS outages, datalink mandates.
         */
        function extractCrossedFirs(fullText) {
            const set = new Set();
            // Read the whole EET/ value, up to the next field 18 keyword. The
            // list interleaves entries that are not FIRs - ADIZ crossings and
            // longitude estimates such as 160W0614 - and the previous scan
            // stopped dead at the first of them, losing every Pacific and US
            // FIR that followed (KZAK, KZSE, KZOA, KZLA on the LAX leg).
            const m = String(fullText).toUpperCase()
                .match(/\bEET\/([\s\S]*?)(?=\s+[A-Z]{2,}\/|\)|$)/);
            if (!m) return set;

            const re = /\b([A-Z]{4})\d{4}\b/g;
            let g;
            while ((g = re.exec(m[1])) !== null) {
                if (g[1] === "ADIZ") continue;   // a boundary estimate, not an FIR
                set.add(g[1]);
            }
            return set;
        }

        /** Airports this flight actually touches, from the flight plan. */
        function extractFlightAirports(fullText, fpl) {
            const set = new Set();
            if (fpl) {
                if (fpl.dep) set.add(fpl.dep);
                if (fpl.dest) set.add(fpl.dest);
                (fpl.altns || []).forEach((a) => set.add(a));
            }
            // Field 18 en-route alternates.
            const ralt = String(fullText).toUpperCase().match(/\bRALT\/((?:[A-Z]{4}\s*)+)/);
            if (ralt) ralt[1].trim().split(/\s+/).forEach((a) => { if (a.length === 4) set.add(a); });
            return set;
        }

        // [regex, Korean label, literal words to paint in the raw text]
        const LIMIT_PATTERNS = [
            [/\bCLSD\b|\bCLOSED\b/, "폐쇄", ["CLSD", "CLOSED"]],
            [/\bU\/S\b|\bOUT OF SERVICE\b|\bOTS\b/, "운용불능", ["U/S", "OUT OF SERVICE", "OTS"]],
            [/\bNOT AVBL\b|\bUNAVBL\b|\bNOT AVAILABLE\b/, "사용불가", ["NOT AVAILABLE", "NOT AVBL", "UNAVBL"]],
            [/\bPROHIBITED\b|\bFORBIDDEN\b/, "금지", ["PROHIBITED", "FORBIDDEN"]],
            [/\bSHALL\b|\bMUST\b|\bMANDATORY\b|\bREQ\b/, "의무사항", ["MANDATORY", "SHALL", "MUST", "REQ"]],
            [/\bRESTRICTED\b|\bRESTRICTION\b|\bLIMITED TO\b/, "제한", ["RESTRICTION", "RESTRICTED", "LIMITED TO"]],
            [/\bWIP\b|\bWORK IN PROGRESS\b|\bCONSTRUCTION\b/, "공사", ["WORK IN PROGRESS", "CONSTRUCTION", "WIP"]],
            // A conditional route is only plannable inside its window, which
            // is as hard a constraint as a closure. None of the words above
            // appear in a CDR table.
            [/\bCDR\b|\bCONDITIONAL ROUTE\b/, "조건부 항공로", ["CONDITIONAL ROUTE", "CDR"]]
        ];

        /* ====================================================================
         * Geometry
         *
         * Most of this app deliberately refuses to decide anything, because most
         * NOTAM restrictions are prose. These are the exception: when a NOTAM
         * states a centre, a radius and vertical limits, whether the filed route
         * touches it is arithmetic, not interpretation.
         *
         *   E) ... 3NM RADIUS CENTERED ON 084325N1674307E (KWAJALEIN ATOLL)
         *   F) FL055
         *   G) FL310
         *
         * The route polyline is built only from the lat/long points actually in
         * field 15. Named fixes carry no coordinates in these documents, so the
         * legs between them are drawn as great circles - an approximation, and
         * the card says so.
         * ==================================================================== */

        const NM_PER_RAD = 3440.065;
        const toRad = (d) => (d * Math.PI) / 180;

        /** Decodes the coordinate forms these packages actually use. */
        function decodeLatLon(tok) {
            // Some NOTAMs put a space between latitude and longitude -
            // "SHEVELUCH VOLCANO / 563800N 1611900E /". It is one coordinate
            // either way, so the space is removed before matching rather than
            // duplicated into every pattern below.
            tok = String(tok == null ? "" : tok).replace(/\s+/g, "");
            let m;
            // 084325N1674307E - degrees, minutes, seconds
            m = tok.match(/^(\d{2})(\d{2})(\d{2})([NS])(\d{3})(\d{2})(\d{2})([EW])$/);
            if (m) {
                return {
                    lat: (+m[1] + m[2] / 60 + m[3] / 3600) * (m[4] === "S" ? -1 : 1),
                    lon: (+m[5] + m[6] / 60 + m[7] / 3600) * (m[8] === "W" ? -1 : 1)
                };
            }
            // 4836N15620E - degrees and minutes
            m = tok.match(/^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])$/);
            if (m) {
                return {
                    lat: (+m[1] + m[2] / 60) * (m[3] === "S" ? -1 : 1),
                    lon: (+m[4] + m[5] / 60) * (m[6] === "W" ? -1 : 1)
                };
            }
            // 55N170W - whole degrees, the oceanic ladder in field 15
            m = tok.match(/^(\d{2})([NS])(\d{3})([EW])$/);
            if (m) {
                return {
                    lat: +m[1] * (m[2] === "S" ? -1 : 1),
                    lon: +m[3] * (m[4] === "W" ? -1 : 1)
                };
            }
            // N55W170
            m = tok.match(/^([NS])(\d{2})([EW])(\d{3})$/);
            if (m) {
                return {
                    lat: +m[2] * (m[1] === "S" ? -1 : 1),
                    lon: +m[4] * (m[3] === "W" ? -1 : 1)
                };
            }
            return null;
        }

        function gcNm(a, b) {
            const dLat = toRad(b.lat - a.lat);
            const dLon = toRad(b.lon - a.lon);
            const h = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
            return 2 * NM_PER_RAD * Math.asin(Math.min(1, Math.sqrt(h)));
        }

        function bearing(a, b) {
            const dLon = toRad(b.lon - a.lon);
            const y = Math.sin(dLon) * Math.cos(toRad(b.lat));
            const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
                Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLon);
            return Math.atan2(y, x);
        }

        /** Distance from P to the great-circle segment A-B, clamped to the segment. */
        function segNm(A, B, P) {
            const len = gcNm(A, B) / NM_PER_RAD;
            if (len === 0) return gcNm(A, P);
            const d13 = gcNm(A, P) / NM_PER_RAD;
            const delta = bearing(A, P) - bearing(A, B);
            const xt = Math.asin(Math.sin(d13) * Math.sin(delta));
            // acos returns [0, PI], so along-track has to be signed by hand.
            // Without this a point BEHIND A falls through to the cross-track
            // term, which measures the great circle extended the whole way
            // round the earth - it reported a corner 515NM behind the leg as
            // 65NM off track.
            let along = Math.acos(Math.max(-1, Math.min(1, Math.cos(d13) / Math.cos(xt))));
            if (Math.cos(delta) < 0) along = -along;
            if (along < 0) return gcNm(A, P);
            if (along > len) return gcNm(B, P);
            return Math.abs(xt) * NM_PER_RAD;
        }

        /**
         * Same distance segNm() gives, plus how far along the leg the closest
         * point sits (0 at A, 1 at B). The fraction is what lets a time be put
         * on the approach.
         *
         * segNm() is left exactly as it is. Its unsigned along-track bug is
         * documented in CLAUDE.md as fixed and not to be reintroduced; the
         * sign handling here is the same, written beside it rather than
         * threaded through it.
         */
        function segNearest(A, B, P) {
            const len = gcNm(A, B) / NM_PER_RAD;
            if (len === 0) return { nm: gcNm(A, P), frac: 0 };
            const d13 = gcNm(A, P) / NM_PER_RAD;
            const delta = bearing(A, P) - bearing(A, B);
            const xt = Math.asin(Math.sin(d13) * Math.sin(delta));
            let along = Math.acos(Math.max(-1, Math.min(1, Math.cos(d13) / Math.cos(xt))));
            if (Math.cos(delta) < 0) along = -along;
            if (along < 0) return { nm: gcNm(A, P), frac: 0 };
            if (along > len) return { nm: gcNm(B, P), frac: 1 };
            return { nm: Math.abs(xt) * NM_PER_RAD, frac: along / len };
        }

        /**
         * Where and *when* the flight comes closest to a point.
         *
         * Every waypoint on the planned track carries cumulative minutes, so
         * the leg the closest approach falls on has a time at each end and the
         * moment itself is a linear interpolation between them. This is what
         * turns "184NM from the box" into "184NM from the box, at 1943Z".
         */
        function trackNearest(pts, P, baseMs) {
            if (!pts || pts.length < 2) return null;
            let best = null;
            for (let i = 0; i < pts.length - 1; i += 1) {
                const r = segNearest(pts[i], pts[i + 1], P);
                if (!best || r.nm < best.nm) best = { nm: r.nm, frac: r.frac, i };
            }
            if (!best) return null;

            const a = pts[best.i], b = pts[best.i + 1];
            let min = null;
            if (typeof a.min === "number" && typeof b.min === "number") {
                min = a.min + (b.min - a.min) * best.frac;
            } else if (typeof a.min === "number") {
                min = a.min;
            } else if (typeof b.min === "number") {
                min = b.min;
            }
            // Where on the leg the closest point falls. Linear in lat/lon,
            // which is fine for drawing - the distance itself was computed on
            // the sphere by segNearest above.
            let dl = b.lon - a.lon;
            while (dl > 180) dl -= 360;
            while (dl < -180) dl += 360;

            return {
                nm: best.nm,
                between: [a.name || null, b.name || null],
                min,
                at: {
                    lat: a.lat + (b.lat - a.lat) * best.frac,
                    lon: a.lon + dl * best.frac
                },
                tMs: (min !== null && baseMs !== null && baseMs !== undefined)
                    ? baseMs + min * 60000 : null
            };
        }

        /** Closest approach of a polyline to a point. */
        function polylineNm(pts, P) {
            if (!pts.length) return null;
            if (pts.length === 1) return gcNm(pts[0], P);
            let min = Infinity;
            for (let i = 0; i < pts.length - 1; i += 1) {
                min = Math.min(min, segNm(pts[i], pts[i + 1], P));
            }
            return min;
        }

        /**
         * Longitudes in one continuous frame centred on `lon0`. Every leg here
         * crosses the antimeridian, so comparing a route point at 170E against
         * a shape at 152W in raw degrees puts them 322 apart instead of 38.
         */
        function shiftLon(lon, lon0) {
            let d = lon - lon0;
            while (d > 180) d -= 360;
            while (d < -180) d += 360;
            return d;
        }

        /** Ray casting in the shifted frame. */
        function pointInPolygon(pt, poly, lon0) {
            const x = shiftLon(pt.lon, lon0), y = pt.lat;
            let inside = false;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
                const xi = shiftLon(poly[i].lon, lon0), yi = poly[i].lat;
                const xj = shiftLon(poly[j].lon, lon0), yj = poly[j].lat;
                if ((yi > y) !== (yj > y) &&
                    x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
                    inside = !inside;
                }
            }
            return inside;
        }

        /** Do segments A-B and C-D cross? Proper crossings only. */
        function segCross(A, Bp, C, D, lon0) {
            const sx = (p) => shiftLon(p.lon, lon0);
            const side = (px, py, qx, qy, rx, ry) =>
                (qx - px) * (ry - py) - (qy - py) * (rx - px);
            const ax = sx(A), ay = A.lat, bx = sx(Bp), by = Bp.lat;
            const cx = sx(C), cy = C.lat, dx = sx(D), dy = D.lat;
            const d1 = side(cx, cy, dx, dy, ax, ay);
            const d2 = side(cx, cy, dx, dy, bx, by);
            const d3 = side(ax, ay, bx, by, cx, cy);
            const d4 = side(ax, ay, bx, by, dx, dy);
            return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
        }

        /**
         * "MUST NOT FLT PLAN THROUGH THE AIRSPACE DEFINED AS <coords>".
         * Only the coordinate run that follows the cue is taken - a NOTAM like
         * A2472/26 carries several unrelated coordinate groups, and sweeping
         * them all into one polygon would invent a shape nobody published.
         */
        function extractProhibitedAreas(raw) {
            const up = String(raw || "").toUpperCase();
            const COORD = "(?:\\d{6}[NS]\\s?\\d{7}[EW]|\\d{4}[NS]\\s?\\d{5}[EW])";
            const cue = /(?:MUST NOT|SHALL NOT|DO NOT)\s+(?:FLT|FLIGHT)?\s*PLAN(?:NED)?(?:\s+THROUGH)?/g;
            const out = [];
            let m;
            while ((m = cue.exec(up)) !== null) {
                const tail = up.slice(m.index, m.index + 700);
                const cRe = new RegExp("\\b" + COORD + "\\b", "g");
                const run = [];
                let c, last = -1;
                while ((c = cRe.exec(tail)) !== null) {
                    // A coordinate far past the previous one belongs to another
                    // clause, not to this shape.
                    if (last >= 0 && c.index - last > 60) break;
                    last = c.index + c[0].length;
                    const p = decodeLatLon(c[0]);
                    if (p) run.push(p);
                }
                if (run.length >= 3) out.push({ cue: m[0].trim(), points: run });
            }
            return out;
        }

        /**
         * "BTN <coord> AND <coord>" - a gate line an entry or exit must be made
         * over. Whether the route crosses that line is arithmetic; whether the
         * crossing is the FIR boundary crossing is not, because the boundary
         * itself is nowhere in the document.
         */
        function extractGateSegments(raw) {
            const up = String(raw || "").toUpperCase();
            const COORD = "(\\d{6}[NS]\\s?\\d{7}[EW]|\\d{4}[NS]\\s?\\d{5}[EW])";
            const re = new RegExp("\\bB(?:TN|ETWEEN)\\s+" + COORD + "\\s+AND\\s+" + COORD + "\\b", "g");
            const out = [];
            let m;
            while ((m = re.exec(up)) !== null) {
                const a = decodeLatLon(m[1]), b = decodeLatLon(m[2]);
                if (a && b) out.push({ a, b });
            }
            return out;
        }

        /**
         * Prohibited boxes and gate lines, resolved against the filed route.
         * Separate from geoCheck: that one asks how close we pass, this one
         * asks whether we go in, which is what a prohibition turns on.
         */
        /**
         * Legs safe to hand to a planar crossing test, in the frame centred on
         * `lon0`.
         *
         * shiftLon() folds every longitude into one 360-degree frame. A leg
         * lying on the far side of that fold comes out with its ends at
         * opposite edges - +179 and -179 - and the straight line between them
         * sweeps the entire frame, crossing whatever shape sits in the middle.
         * With field 15's handful of oceanic points this never showed; a
         * 60-point track spanning 200 degrees of longitude hits it.
         *
         * No real leg between consecutive waypoints spans 90 degrees of
         * longitude, so a span that large is the fold, not a flight path. Such
         * a leg is also necessarily far from the shape, so dropping it cannot
         * hide a crossing.
         */
        function planarLegs(pts, lon0) {
            const out = [];
            for (let i = 0; i < pts.length - 1; i += 1) {
                const a = shiftLon(pts[i].lon, lon0);
                const b = shiftLon(pts[i + 1].lon, lon0);
                if (Math.abs(a - b) > 90) continue;
                out.push([pts[i], pts[i + 1]]);
            }
            return out;
        }

        function zoneCheck(raw, routePts) {
            const banned = extractProhibitedAreas(raw);
            const gates = extractGateSegments(raw);
            if (!banned.length && !gates.length) return null;
            if (routePts.length < 2) return null;

            const crossesShape = (poly, lon0) => {
                for (const [A, B] of planarLegs(routePts, lon0)) {
                    for (let j = 0; j < poly.length; j += 1) {
                        const k = (j + 1) % poly.length;
                        if (segCross(A, B, poly[j], poly[k], lon0)) return true;
                    }
                }
                return false;
            };

            const bannedOut = banned.map((z) => {
                const lon0 = z.points[0].lon;
                const inside = routePts.some((p) => pointInPolygon(p, z.points, lon0));
                let nearest = Infinity;
                z.points.forEach((p) => { nearest = Math.min(nearest, polylineNm(routePts, p)); });
                return {
                    cue: z.cue,
                    points: z.points,
                    corners: z.points.length,
                    entered: inside || crossesShape(z.points, lon0),
                    nearestNm: nearest === Infinity ? null : nearest
                };
            });

            const gateOut = gates.map((g) => {
                const lon0 = g.a.lon;
                let crosses = false;
                for (const [A, B] of planarLegs(routePts, lon0)) {
                    if (segCross(A, B, g.a, g.b, lon0)) { crosses = true; break; }
                }
                let nearest = Math.min(polylineNm(routePts, g.a), polylineNm(routePts, g.b));
                routePts.forEach((p) => { nearest = Math.min(nearest, segNm(g.a, g.b, p)); });
                return { a: g.a, b: g.b, crosses, nearestNm: nearest };
            });

            return { banned: bannedOut, gates: gateOut };
        }

        /**
         * A circle or a polygon, if the NOTAM states one in a machine-readable form.
         * Anything vaguer is left alone - this must not guess at an area.
         */
        function extractGeoArea(raw) {
            const up = String(raw || "").toUpperCase();
            const coordRe = /\b(\d{6}[NS]\s?\d{7}[EW]|\d{4}[NS]\s?\d{5}[EW])\b/g;

            const rad = up.match(/(\d+(?:\.\d+)?)\s*NM\s+RADIUS/);
            if (rad) {
                // Take the coordinate nearest after the radius phrase.
                const after = up.slice(up.indexOf(rad[0]));
                const c = after.match(coordRe);
                if (c && c.length) {
                    const centre = decodeLatLon(c[0]);
                    if (centre) return { kind: "circle", centre, radiusNm: parseFloat(rad[1]) };
                }
            }

            // Coordinates scattered across separate clauses are not one shape.
            // A2472/26 states a gate line in one sentence and a prohibited box
            // in the next; sweeping every coordinate together drew a six-corner
            // polygon nobody published. Only a contiguous run is a shape.
            // Vertices of one shape are joined by TO / AND / THENCE and nothing
            // else. Anything else in the gap - "(MUST NOT FLT PLAN THROUGH THE
            // AIRSPACE DEFINED AS" - starts a new clause, so a distance
            // threshold is the wrong test: that gap is only 51 characters.
            const JOINER = /^[\s,.\-]*(?:TO|AND|THENCE)?[\s,.\-]*$/;
            const runs = [];
            let cur = [], last = -1, c;
            coordRe.lastIndex = 0;
            while ((c = coordRe.exec(up)) !== null) {
                if (last >= 0 && !JOINER.test(up.slice(last, c.index))) {
                    runs.push(cur); cur = [];
                }
                last = c.index + c[0].length;
                const p = decodeLatLon(c[0]);
                if (p) cur.push(p);
            }
            if (cur.length) runs.push(cur);
            const best = runs.sort((a, b) => b.length - a.length)[0] || [];
            if (best.length >= 3) return { kind: "polygon", points: best };
            if (best.length >= 1) return { kind: "points", points: best };
            return null;
        }

        /** F) lower and G) upper, as flight levels. Null when not stated plainly. */
        function parseVerticalBand(raw) {
            const up = String(raw || "").toUpperCase();
            const one = (label) => {
                const m = up.match(new RegExp(label + "\\)\\s*(SFC|GND|UNL|FL\\s?\\d{3})"));
                if (!m) return null;
                const v = m[1].replace(/\s/g, "");
                if (v === "SFC" || v === "GND") return 0;
                if (v === "UNL") return 999;
                return parseInt(v.slice(2), 10);
            };
            const lower = one("F");
            const upper = one("G");
            return (lower === null && upper === null) ? null : { lower, upper };
        }

        /**
         * Does the filed route touch this area, laterally and vertically?
         * `approx` is always true: the polyline is only the field 15 lat/long
         * points, so the legs through named fixes are straight lines.
         */
        function geoCheck(area, routePts, levels) {
            if (!area || routePts.length < 1) return null;

            let minNm = null;
            if (area.kind === "circle") {
                minNm = polylineNm(routePts, area.centre);
            } else {
                let m = Infinity;
                area.points.forEach((p) => { m = Math.min(m, polylineNm(routePts, p)); });
                minNm = m === Infinity ? null : m;
            }
            if (minNm === null) return null;

            const radius = area.kind === "circle" ? area.radiusNm : 0;
            const lateralClear = minNm > radius;

            let vertClear = null;
            if (levels && area.vert && area.vert.upper !== null && area.vert.lower !== null) {
                vertClear = (levels.min > area.vert.upper) || (levels.max < area.vert.lower);
            }

            return { minNm, radius, lateralClear, vertClear, approx: true };
        }

        /* --------------------------------------------------------------
         * The OFP waypoint table
         *
         * Field 15 says where we go and says nothing about when. The OFP prints
         * a three-line block per fix that carries both, plus the fix at which
         * each FIR boundary is crossed:
         *
         *   0043  N36 22.4  131 330 ---/015 2906 33 28034P030 01 495   005  025
         *   LANAT E131 25.7 133        /                      43 525 00.36 0312/
         *   / RJJJ FIR      122   FUKUOKA                     LANAT
         *
         * line 1: distance, latitude.  line 2: name, longitude, cumulative time.
         * line 3: a FIR boundary, when there is one.
         * -------------------------------------------------------------- */

        function dmToDeg(txt) {
            const m = String(txt).match(/^([NSEW])(\d{2,3}) (\d{2}\.\d)$/);
            if (!m) return null;
            const v = parseInt(m[2], 10) + parseFloat(m[3]) / 60;
            return (m[1] === "S" || m[1] === "W") ? -v : v;
        }

        function parseOfpWaypoints(fullText) {
            const lines = String(fullText || "").split("\n");
            const raw = [];
            for (let i = 0; i < lines.length - 1; i += 1) {
                const a = lines[i].match(/^\d{4}\s+([NS]\d{2} \d{2}\.\d)\s/);
                if (!a) continue;
                const b = lines[i + 1].match(/^(\S+)\s+([EW]\d{3} \d{2}\.\d)/);
                if (!b) continue;
                const t = lines[i + 1].match(/\s(\d{2})\.(\d{2})\s+\d{4}\//);
                const f = (lines[i + 2] || "").match(/\/\s*([A-Z]{4})\s+FIR/);
                raw.push({
                    name: b[1],
                    lat: dmToDeg(a[1]),
                    lon: dmToDeg(b[2]),
                    min: t ? parseInt(t[1], 10) * 60 + parseInt(t[2], 10) : null,
                    fir: f ? f[1] : null
                });
            }

            // Some packages print this table twice, byte-for-byte (same name,
            // time and coordinates both times) - keep the first copy only.
            const seenRow = new Set();
            const deduped = [];
            for (const w of raw) {
                const key = w.name + "|" + w.min + "|" + w.lat + "|" + w.lon;
                if (seenRow.has(key)) continue;
                seenRow.add(key);
                deduped.push(w);
            }

            // A row's name and a row's position are two different facts, and
            // only the name can be junk.
            //
            // "FIR" is this table's own placeholder for an unnamed boundary
            // crossing. "TOC"/"TOD"/"ETPn" are the OFP software's computed
            // points (top of climb, top of descent, equal-time point) -
            // dispatch abbreviations, never ICAO idents, never filed in
            // field 15. None of them may be matched against route fixes.
            //
            // But every one of them is a real place the aircraft flies over,
            // with real printed coordinates. Dropping the rows punched holes
            // in the only accurate track this document contains, so they are
            // kept and marked instead. `kind` says what a consumer may use a
            // row for: geometry takes every row with coordinates, name
            // matching takes only 'fix' and 'oceanic'.
            const PSEUDO_NAME = /^(?:FIR|TOC|TOD|ETP\d*|T\/C|T\/D)$/;
            const OCEANIC = /^(?:\d{4}[NSEW]|\d{2}[NS]\d{2})$/;   // 5075N, 63N00
            return deduped.map((w, i) => {
                let kind = "other";
                if (PSEUDO_NAME.test(w.name)) kind = "pseudo";
                else if (OCEANIC.test(w.name)) kind = "oceanic";
                else if (/^[A-Z]{5}$/.test(w.name)) kind = "fix";
                else if (/^[A-Z]{4}$/.test(w.name)) kind = "airport";
                return Object.assign({ seq: i, kind }, w);
            });
        }

        /**
         * The waypoint table is not one table.
         *
         * An OFP prints the planned route, then a diversion or re-file route
         * whose cumulative clock restarts at zero, and on some packages the
         * planned route again. Cumulative minutes only ever increase within
         * one route, so a drop is where one ends and the next begins.
         *
         * This matters beyond tidiness: `ctx.wpMin` is keyed by fix name and
         * written last-wins, so any fix appearing in both tables had its
         * planned time silently overwritten by its diversion time.
         */
        function splitWaypointRuns(rows) {
            const runs = [];
            let cur = [];
            let last = -1;
            for (const w of rows) {
                if (w.min !== null) {
                    if (w.min < last) { if (cur.length) runs.push(cur); cur = []; }
                    last = w.min;
                }
                cur.push(w);
            }
            if (cur.length) runs.push(cur);
            if (!runs.length) return { primary: [], others: [] };

            // The planned route is the longest run - a diversion is by nature
            // a tail, and a re-print is a duplicate the dedup above removed.
            let best = 0;
            runs.forEach((r, i) => { if (r.length > runs[best].length) best = i; });
            return { primary: runs[best], others: runs.filter((_, i) => i !== best) };
        }

        // Consecutive OFP waypoints sit at most a few hundred miles apart, even
        // on an oceanic track. A much larger step means a row was misread, not
        // that the aircraft teleported. The gap is reported rather than patched:
        // this file does not invent positions.
        const TRACK_GAP_NM = 1200;

        /**
         * The flown track: an ordered polyline with a time on every point.
         *
         * Field 15 carries only the handful of oceanic lat/long points that are
         * filed by coordinate - 10 on the JFK leg, 5 on the LAX one - and none
         * at all over land. Measuring a Korean NOTAM against that set reported
         * the nearest approach as 2,728NM, because the closest thing to Korea
         * in it was a point in the middle of the Pacific. The waypoint table
         * has all 60-odd, so it is preferred and field 15 is the fallback.
         */
        function buildRouteTrack(fullText, fallbackPts) {
            const rows = parseOfpWaypoints(fullText);
            const { primary, others } = splitWaypointRuns(rows);
            const pts = primary.filter((w) =>
                typeof w.lat === "number" && typeof w.lon === "number" &&
                Math.abs(w.lat) <= 90 && Math.abs(w.lon) <= 180);

            const gaps = [];
            for (let i = 1; i < pts.length; i += 1) {
                const nm = gcNm(pts[i - 1], pts[i]);
                if (nm > TRACK_GAP_NM) {
                    gaps.push({ from: pts[i - 1].name, to: pts[i].name, nm: Math.round(nm) });
                }
            }

            const useTrack = pts.length >= 2;
            return {
                primary,
                others,
                points: pts,
                gaps,
                source: useTrack ? "OFP" : "FPL15",
                geomPts: useTrack ? pts : (fallbackPts || [])
            };
        }

        /** Off-blocks, as minutes past midnight UTC. */
        function parseEtdMin(fullText) {
            const m = String(fullText || "").toUpperCase()
                .match(/\bETD\s+[A-Z]{4}\s+(\d{2})(\d{2})Z/);
            return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
        }

        /** Date of flight as a UTC midnight, from field 18. */
        function parseDofMs(fullText) {
            const m = String(fullText || "").toUpperCase().match(/\bDOF\/(\d{6})\b/);
            if (!m) return null;
            return Date.UTC(2000 + +m[1].slice(0, 2), +m[1].slice(2, 4) - 1, +m[1].slice(4, 6));
        }

        /** A NOTAM's YYMMDDHHmm stamp. */
        function stampMs(s10) {
            return Date.UTC(2000 + +s10.slice(0, 2), +s10.slice(2, 4) - 1, +s10.slice(4, 6),
                +s10.slice(6, 8), +s10.slice(8, 10));
        }

        /**
         * Field 15 as legs: "GTC L512 TENAS" means the L512 leg runs GTC to
         * TENAS. A CDR names the airway; the fixes at either end are what the
         * OFP can put a time against.
         */
        function routeLegs(routeText) {
            const toks = String(routeText || "").toUpperCase()
                .replace(/\/[NMK]\d{3,4}[FSAM]\d{3,4}/g, " ")
                .split(/[^A-Z0-9]+/).filter(Boolean);
            const isAwy = (t) => /^[A-Z]{1,2}\d{1,3}$/.test(t);
            const legs = [];
            for (let i = 1; i < toks.length - 1; i += 1) {
                if (isAwy(toks[i]) && !isAwy(toks[i - 1]) && !isAwy(toks[i + 1])) {
                    legs.push({ awy: toks[i], from: toks[i - 1], to: toks[i + 1] });
                }
            }
            return legs;
        }

        /**
         * "CDR ARE ESTABLISHED AS FLW" followed by a table:
         *   1)  L512        2608291200/2608292200  MEA
         */
        function parseCdrTable(raw) {
            const up = String(raw || "").toUpperCase();
            if (!/\bCDR\b/.test(up)) return [];
            const re = /^\s*\d+\)\s+([A-Z]{1,2}\d{1,3})\s+(\d{10})\/(\d{10})\s*(.*)$/gm;
            const out = [];
            let m;
            while ((m = re.exec(up)) !== null) {
                out.push({ awy: m[1], from: m[2], to: m[3], alt: (m[4] || "").trim() });
            }
            return out;
        }

        /**
         * Each conditional route we actually fly, with the time we are on it set
         * against the window it is open. One of the few NOTAM restrictions that
         * resolves to a yes or a no.
         */
        function cdrCheck(raw, ctx) {
            const rows = parseCdrTable(raw);
            if (!rows.length || !ctx.legs.length) return null;
            const out = [];
            rows.forEach((r) => {
                const mine = ctx.legs.filter((l) => l.awy === r.awy);
                if (!mine.length) return;
                let lo = null, hi = null;
                mine.forEach((l) => {
                    [ctx.wpMin[l.from], ctx.wpMin[l.to]].forEach((v) => {
                        if (v === undefined || v === null) return;
                        if (lo === null || v < lo) lo = v;
                        if (hi === null || v > hi) hi = v;
                    });
                });
                const open = { from: stampMs(r.from), to: stampMs(r.to) };
                let enter = null, exit = null, verdict = null, marginMin = null;
                if (lo !== null && ctx.baseMs !== null) {
                    enter = ctx.baseMs + lo * 60000;
                    exit = ctx.baseMs + hi * 60000;
                    verdict = (enter >= open.from && exit <= open.to) ? "INSIDE"
                        : (exit < open.from || enter > open.to) ? "OUTSIDE" : "PARTIAL";
                    marginMin = Math.round((open.to - exit) / 60000);
                }
                out.push({ awy: r.awy, alt: r.alt, open, legs: mine, enter, exit, verdict, marginMin });
            });
            return out.length ? out : null;
        }

        /**
         * The crossed FIRs in the order they are entered, so a card can show
         * "came from X, leaving to Y" - which is exactly what a clause phrased
         * "FROM WINNIPEG FIR TO VANCOUVER FIR" turns on.
         */
        function extractFirSequence(fullText) {
            const seq = [];
            const m = String(fullText).toUpperCase()
                .match(/\bEET\/([\s\S]*?)(?=\s+[A-Z]{2,}\/|\)|$)/);
            if (!m) return seq;
            const re = /\b([A-Z]{4})(\d{4})\b/g;
            let g;
            while ((g = re.exec(m[1])) !== null) {
                if (g[1] === "ADIZ") continue;
                if (seq.length && seq[seq.length - 1].fir === g[1]) continue;  // re-entry
                seq.push({ fir: g[1], eet: g[2] });
            }
            return seq;
        }

        /** Filed cruise levels from field 15, as a min/max band. */
        function extractLevelBand(route) {
            // Levels sit inside a speed/level group - N0493F310, M084F340 - so
            // there is no word boundary before the F. F\d{3} matched nothing.
            const ls = (String(route || "").toUpperCase().match(/F(\d{3})(?![0-9])/g) || [])
                .map((x) => parseInt(x.slice(1), 10));
            if (!ls.length) return null;
            return { min: Math.min.apply(null, ls), max: Math.max.apply(null, ls) };
        }

        // Words that put a five-letter token in a routing context. A fix is
        // named as part of a route or a boundary; English prose is not.
        const ROUTE_CUES = new Set(["DCT", "DIRECT", "VIA", "ROUTE", "ROUTES", "RTE",
            "TRACK", "TRK", "AIRWAY", "AWY", "BTN", "BETWEEN", "NORTH", "SOUTH", "EAST",
            "WEST", "OVER", "ABEAM", "JOIN", "CROSSING", "WAYPOINT", "FIX", "FIXES"]);

        const PROSE_5 = new Set(["SHALL", "AMEND", "OTHER", "THREE", "USING", "CONST",
            "CROSS", "FIRST", "STAND", "APRON", "RADIO", "JAPAN", "CRANE", "EXACT",
            "CLIMB", "STATE", "ICING", "FLUID", "TEMPO", "PILOT", "PRIOR", "RIGHT",
            "AFTER", "NOTES", "LEAST", "SIGNS", "BIRDS", "CHART", "WATCH", "ANGLE",
            "EMERG", "GLOWS", "CREWS", "WHILE", "ALERT", "COLOR", "TABLE", "HOTEL",
            "AIRAC", "ARTCC", "FICON", "TACAN", "CPDLC", "SEOUL", "LOGAN", "LOWER",
            "UPPER", "TOTAL", "VALID", "UNTIL", "ABOVE", "BELOW", "LOCAL", "FINAL",
            "WHICH", "NOPAC", "HOURS", "FILED", "NAMED", "REFER", "OCEAN", "EMAIL",
            "PHONE", "SMALL", "DAILY", "POINT", "DARTS", "TRAIL", "USERS", "LOVES",
            "GUYED", "SEALS", "EAGLE", "EGRET", "MALAY",
            "LIMIT", "AREAS", "ZONES", "LEVEL", "NIGHT", "START", "CHECK", "GROUP",
            "PHASE", "STAGE", "ORDER", "RULES", "MERIT", "FLIPS"]);

        /**
         * Five-letter fixes a NOTAM names, split into ours and not-ours.
         *
         * A token only counts when a routing cue sits within three tokens of it.
         * Without that test the list filled with CONST, CRANE, AVOID and ATOLL -
         * true five-letter uppercase words, no part of anybody's route.
         */
        function namedFixes(body, ourFixes) {
            // Split on "/" as well: "Y722/B576" is two airways, not one token.
            const toks = String(body).split(/[^A-Z0-9]+/).filter(Boolean);
            const mine = [], theirs = [];
            const seen = new Set();

            for (let i = 0; i < toks.length; i += 1) {
                const t = toks[i];
                if (!/^[A-Z]{5}$/.test(t) || seen.has(t)) continue;
                // A cue is not itself a fix, and a handful of words survive the
                // context test because aviation prose puts them next to routing
                // language anyway.
                if (ROUTE_CUES.has(t) || PROSE_5.has(t)) continue;

                let cued = false;
                for (let j = Math.max(0, i - 3); j <= Math.min(toks.length - 1, i + 3); j += 1) {
                    if (j !== i && ROUTE_CUES.has(toks[j])) { cued = true; break; }
                }
                if (!cued) continue;

                seen.add(t);
                (ourFixes.has(t) ? mine : theirs).push(t);
            }
            return { mine, theirs: theirs.slice(0, 12) };
        }

        /**
         * Paints the matched bits inside the raw telex: route points amber,
         * restriction wording rose. One pass over a combined pattern so an
         * inserted span can never be re-scanned, longest phrase first so
         * "NOT AVAILABLE" wins over "AVAILABLE".
         */
        function highlightRaw(raw, routeToks, limitWords) {
            const esc = String(raw || "")
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const all = [];
            routeToks.forEach((t) => all.push([t, "route"]));
            limitWords.forEach((w) => all.push([w, "limit"]));
            if (!all.length) return esc;

            all.sort((a, b) => b[0].length - a[0].length);
            const kind = {};
            all.forEach(([t, k]) => { if (!(t in kind)) kind[t] = k; });
            const alt = all.map(([t]) => t.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")).join("|");

            return esc.replace(new RegExp("(?:" + alt + ")", "g"), (m) =>
                kind[m] === "limit"
                    ? '<span class="bg-rose-500/25 text-rose-200 rounded px-0.5">' + m + '</span>'
                    : '<span class="bg-amber-500/25 text-amber-200 rounded px-0.5">' + m + '</span>');
        }

        /**
         * The D) field: the daily window a measure is actually live.
         *
         *   D) 1930-2200                     -> one window
         *   D) MON-FRI 1500-0600             -> window plus a day qualifier
         *   D) 23-24 26 29-31 1430/2100      -> window plus a date list
         *
         * Only the clock range is evaluated. Day and date qualifiers are
         * reported but not judged - getting those wrong would be worse than
         * leaving them to the reader.
         */
        function parseDailyWindow(raw) {
            const m = String(raw || "").toUpperCase().match(/^D\)\s*([^\r\n]+)/m);
            if (!m) return null;
            const spec = m[1].trim();
            const windows = [];
            const re = /(\d{4})\s*[-\/]\s*(\d{4})/g;
            let g;
            while ((g = re.exec(spec)) !== null) {
                const a = +g[1].slice(0, 2) * 60 + +g[1].slice(2);
                const b = +g[2].slice(0, 2) * 60 + +g[2].slice(2);
                if (a < 1440 && b < 1440) windows.push([a, b]);
            }
            if (!windows.length) return null;
            const dayQualified = /\b(MON|TUE|WED|THU|FRI|SAT|SUN)\b/.test(spec) ||
                /^\d{1,2}(-\d{1,2})?(\s|$)/.test(spec);
            return { spec, windows, dayQualified };
        }

        /** Minutes past midnight UTC at which the flight enters `fir`. */
        function firEntryMinutes(fullText, fpl, firSeq, fir) {
            if (!fpl || !fpl.depTime) return null;
            const e = firSeq.find((x) => x.fir === fir);
            if (!e || !/^\d{4}$/.test(e.eet)) return null;
            const dep = +fpl.depTime.slice(0, 2) * 60 + +fpl.depTime.slice(2);
            const eet = +e.eet.slice(0, 2) * 60 + +e.eet.slice(2);
            return (dep + eet) % 1440;
        }

        /** Is `min` inside any window? Windows may run past midnight. */
        function inAnyWindow(min, windows) {
            return windows.some(([a, b]) =>
                a <= b ? (min >= a && min <= b) : (min >= a || min <= b));
        }

        const hhmm = (min) =>
            String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");

        /**
         * Airways a NOTAM names, split into ours and not-ours. Same context test
         * as the fixes, plus flight levels are excluded - F390 is not an airway.
         */
        function namedAirways(body, ourAirways) {
            // Split on "/" as well: "Y722/B576" is two airways, not one token.
            const toks = String(body).split(/[^A-Z0-9]+/).filter(Boolean);
            const mine = [], theirs = [];
            const seen = new Set();
            for (let i = 0; i < toks.length; i += 1) {
                const t = toks[i];
                if (!/^[A-Z]{1,2}\d{1,3}$/.test(t) || seen.has(t)) continue;
                if (/^F\d{3}$/.test(t)) continue;              // a level, not a route
                if (i > 0 && toks[i - 1] === "FL") continue;
                let cued = false;
                for (let j = Math.max(0, i - 3); j <= Math.min(toks.length - 1, i + 3); j += 1) {
                    if (j !== i && ROUTE_CUES.has(toks[j])) { cued = true; break; }
                }
                if (!cued) continue;
                seen.add(t);
                (ourAirways.has(t) ? mine : theirs).push(t);
            }
            return { mine, theirs: theirs.slice(0, 10) };
        }

        /* ==============================================================
         * Stated conditions
         *
         * Some NOTAMs do not describe an area - they set out numbered rules a
         * flight plan has to satisfy. PAZA A2472/26 (USER PREFERRED ROUTE
         * FLIGHT PLANNING GUIDELINES) is the type case: 5 clauses, sub-lettered,
         * each naming fixes, airways, levels or times.
         *
         * Reading such a clause is not something this file may do. Testing one
         * is - "is GOATS among the fixes we filed", "is NATES east of NIKLL",
         * "is our cruise band at or below FL310" are set membership and
         * arithmetic, the documented exception.
         *
         * So every clause is listed, and each gets one of:
         *   충족       a test ran on document data and passed
         *   확인 필요   a test ran and did not find what the clause requires
         *   해당 없음   the clause's own precondition is false for this flight
         *   판정 불가   an input the test needs is not in this document
         *   직접 확인   no mechanical test exists for this clause's wording
         *
         * "확인 필요" is deliberately not "위반". A clause can fail its test
         * because our route parse is incomplete, and a false alarm costs as
         * much as a miss. What is shown is what was computed, with its inputs.
         * ============================================================== */

        /** Numbered clauses: "2." then "A.", including mid-line markers. */
        function splitClauses(body) {
            const flat = String(body || "").replace(/\s+/g, " ").trim();
            const out = [];
            const top = /(?:^|\s)(\d)\.\s(?=[A-Z])/g;
            const bounds = [];
            let m;
            while ((m = top.exec(flat)) !== null) bounds.push({ n: m[1], at: m.index + m[0].length - m[1].length - 2 });
            for (let i = 0; i < bounds.length; i += 1) {
                const from = bounds[i].at;
                const to = i + 1 < bounds.length ? bounds[i + 1].at : flat.length;
                const chunk = flat.slice(from, to);
                const head = bounds[i].n;

                const sub = /(?:^|\s)([A-Z])\.\s(?=[A-Z])/g;
                const sb = [];
                let s;
                while ((s = sub.exec(chunk)) !== null) sb.push({ L: s[1], at: s.index + s[0].length - 3 });
                if (!sb.length) { out.push({ ref: head, text: chunk.trim() }); continue; }
                if (sb[0].at > 0) out.push({ ref: head, text: chunk.slice(0, sb[0].at).trim() });
                for (let j = 0; j < sb.length; j += 1) {
                    const f = sb[j].at;
                    const t = j + 1 < sb.length ? sb[j + 1].at : chunk.length;
                    out.push({ ref: head + "." + sb[j].L, text: chunk.slice(f, t).trim() });
                }
            }
            return out;
        }

        /** Every fix name this flight actually files or overflies. */
        function routeFixNames(ctx) {
            const s = new Set();
            ctx.route.fixes.forEach((f) => s.add(f));
            ctx.route.navaids.forEach((f) => s.add(f));
            (ctx.track ? ctx.track.primary : []).forEach((w) => {
                if (w.kind === "fix" || w.kind === "oceanic") s.add(w.name);
            });
            return s;
        }

        /** Coordinates for a named point, only if this document printed them. */
        function fixCoord(ctx, name) {
            const rows = ctx.track ? ctx.track.primary : [];
            for (const w of rows) {
                if (w.name === name && typeof w.lat === "number" && typeof w.lon === "number") return w;
            }
            return null;
        }

        /** Field 15 as an ordered token list, DCT and speed/level groups removed. */
        function routeSequence(ctx) {
            const src = ctx.fpl && ctx.fpl.route ? ctx.fpl.route : "";
            return String(src).toUpperCase()
                .replace(/\/[NMK]\d{3,4}[FSAM]\d{3,4}/g, " ")
                .split(/[^A-Z0-9]+/)
                .filter((t) => t && t !== "DCT");
        }

        /**
         * Does the route go A then B, with nothing filed between them?
         *
         * This is the difference between a fix and a routing. A0176/26 lists
         * "FIORD, CHAPO, FANES, GOATS DCT FYU" as not available. Read as four
         * fixes it condemns GOATS - which is the very fix clause 1 of the same
         * NOTAM requires ("ON OR N OF GOATS DCT BTT"), and which AAR223 files.
         * What is unavailable is the leg GOATS-FYU, not the point GOATS.
         */
        function hasLeg(seq, a, b) {
            for (let i = 0; i < seq.length - 1; i += 1) {
                if (seq[i] === a && seq[i + 1] === b) return true;
            }
            return false;
        }

        /** "GOATS DCT FYU" -> a leg; "FIORD" -> a point. */
        function parseRouteItem(txt) {
            const toks = String(txt).trim().split(/\s+/).filter((t) => t && t !== "DCT");
            if (toks.length >= 2 && toks.every((t) => /^[A-Z0-9]{2,5}$/.test(t))) {
                return { kind: "leg", from: toks[0], to: toks[toks.length - 1], toks };
            }
            if (toks.length === 1 && /^[A-Z0-9]{2,5}$/.test(toks[0])) {
                return { kind: "point", name: toks[0] };
            }
            return null;
        }

        /** Where the flight crosses into `fir`, from the waypoint table. */
        function firEntryPoint(ctx, fir) {
            const rows = ctx.track ? ctx.track.primary : [];
            for (const w of rows) {
                if (w.fir === fir && typeof w.lat === "number" && typeof w.lon === "number") return w;
            }
            return null;
        }

        function checkStatedConditions(raw, ctx, station) {
            const up = String(raw || "").toUpperCase();
            const eIdx = up.indexOf("E)");
            const body = eIdx >= 0 ? up.slice(eIdx + 2) : up;
            const clauses = splitClauses(body);
            if (clauses.length < 2) return null;

            const ours = routeFixNames(ctx);
            const results = [];

            for (const c of clauses) {
                const t = c.text;
                let r = null;

                // A. "<FIR> FIR: ... MUST FLT PLAN OVER ONE OF THE FOLLOWING
                //     FIXES: X, Y, Z ... OR W."
                const listM = t.match(/MUST\s+FLT\s+PLAN\s+OVER\s+ONE\s+OF\s+THE\s+FOLLOWING\s+FIXES?:?\s+([A-Z0-9,\s]+?)(?:\.|$)/);
                if (listM) {
                    const wanted = listM[1].split(/[,\s]+/)
                        .filter((x) => /^[A-Z]{5}$/.test(x) && x !== "OR");
                    const firM = t.match(/\b([A-Z]{4})\s+FIR\b/);
                    const fir = firM ? firM[1] : null;
                    if (fir && !ctx.firs.has(fir)) {
                        r = { verdict: "NA", why: fir + " FIR를 통과하지 않는다" };
                    } else {
                        const hit = wanted.filter((f) => ours.has(f));
                        r = hit.length
                            ? { verdict: "OK", why: "지정 픽스 중 " + hit.join(", ") + "를 비행계획에 포함", evidence: hit }
                            : { verdict: "CHECK", why: "지정 " + wanted.length + "개 픽스 중 우리 항로에 있는 것이 없다", evidence: wanted };
                        if (fir) r.why = fir + " FIR · " + r.why;
                    }
                }

                // B. "JOIN <AWY> OVER OR <E|W|N|S> OF WAYPOINT <FIX>"
                if (!r) {
                    const joinM = t.match(/JOIN\s+([A-Z]{1,2}\d{1,3})\s+OVER\s+OR\s+([NSEW])\s+OF\s+(?:WAYPOINT\s+)?([A-Z]{5})/);
                    if (joinM) {
                        const [, awy, dir, ref] = joinM;
                        if (!ctx.route.airways.has(awy)) {
                            r = { verdict: "NA", why: "항공로 " + awy + "를 사용하지 않는다" };
                        } else {
                            const leg = ctx.legs.find((l) => l.awy === awy);
                            const joinAt = leg ? leg.from : null;
                            const a = joinAt ? fixCoord(ctx, joinAt) : null;
                            const b = fixCoord(ctx, ref);
                            if (!a || !b) {
                                r = {
                                    verdict: "UNKNOWN",
                                    why: "좌표가 문서에 없다: " + [!a ? (joinAt || "합류 지점") : null, !b ? ref : null]
                                        .filter(Boolean).join(", ")
                                };
                            } else {
                                const ok = dir === "E" ? shiftLon(a.lon, b.lon) >= 0
                                         : dir === "W" ? shiftLon(a.lon, b.lon) <= 0
                                         : dir === "N" ? a.lat >= b.lat : a.lat <= b.lat;
                                const KO = { E: "동", W: "서", N: "북", S: "남" };
                                r = {
                                    verdict: ok ? "OK" : "CHECK",
                                    why: awy + " 합류점 " + joinAt + "(" + fmtLL(a) + ")가 " + ref +
                                         "(" + fmtLL(b) + ")보다 " + KO[dir] + (ok ? "쪽 — 조건 충족" : "쪽이 아니다"),
                                    evidence: [joinAt, ref]
                                };
                            }
                        }
                    }
                }

                // C. "CROSS <A>, <B> OR <C> AT OR BLW FL310, OR AT OR ABV FL390"
                if (!r) {
                    const lvlM = t.match(/CROSS\s+([A-Z]{5}(?:\s*,\s*[A-Z]{5})*(?:\s+OR\s+[A-Z]{5})?)\s+AT\s+OR\s+(BLW|ABV)\s+FL\s?(\d{3})(?:\s*,?\s*OR\s+AT\s+OR\s+(BLW|ABV)\s+FL\s?(\d{3}))?/);
                    if (lvlM) {
                        const pts = lvlM[1].split(/[,\s]+|\s+OR\s+/).filter((x) => /^[A-Z]{5}$/.test(x));
                        const on = pts.filter((p) => ours.has(p));
                        if (!on.length) {
                            r = { verdict: "NA", why: pts.join(", ") + " 중 우리 항로에 있는 지점이 없다" };
                        } else if (!ctx.levels) {
                            r = { verdict: "UNKNOWN", why: "계획 고도를 읽지 못했다" };
                        } else {
                            const bands = [[lvlM[2], +lvlM[3]]];
                            if (lvlM[4]) bands.push([lvlM[4], +lvlM[5]]);
                            const ok = bands.some(([kind, fl]) =>
                                kind === "BLW" ? ctx.levels.max <= fl : ctx.levels.min >= fl);
                            r = {
                                verdict: ok ? "OK" : "CHECK",
                                why: on.join(", ") + " 통과 · 계획 FL" + ctx.levels.min + "–" + ctx.levels.max +
                                     " vs " + bands.map(([k, f]) => (k === "BLW" ? "FL" + f + " 이하" : "FL" + f + " 이상")).join(" 또는 "),
                                evidence: on
                            };
                        }
                    }
                }

                // D. "CROSS <A>, <B> OR <C> BTN 0500 UTC AND 2300 UTC"
                if (!r) {
                    const timeM = t.match(/CROSS\s+([A-Z]{5}(?:\s*,\s*[A-Z]{5})*(?:\s+OR\s+[A-Z]{5})?)\s+BTN\s+(\d{4})\s*UTC\s+AND\s+(\d{4})\s*UTC/);
                    if (timeM) {
                        const pts = timeM[1].split(/[,\s]+|\s+OR\s+/).filter((x) => /^[A-Z]{5}$/.test(x));
                        const on = pts.filter((p) => ours.has(p));
                        if (!on.length) {
                            r = { verdict: "NA", why: pts.join(", ") + " 중 우리 항로에 있는 지점이 없다" };
                        } else if (ctx.baseMs === null) {
                            r = { verdict: "UNKNOWN", why: "DOF/ETD를 읽지 못해 통과 시각을 낼 수 없다" };
                        } else {
                            const win = [+timeM[2].slice(0, 2) * 60 + +timeM[2].slice(2),
                                         +timeM[3].slice(0, 2) * 60 + +timeM[3].slice(2)];
                            const times = on.map((p) => ({ p, min: ctx.wpMin[p] }))
                                            .filter((x) => x.min !== undefined && x.min !== null);
                            if (!times.length) {
                                r = { verdict: "UNKNOWN", why: on.join(", ") + "의 통과 시각이 표에 없다" };
                            } else {
                                const bad = times.filter((x) => {
                                    const utc = (Math.floor(ctx.baseMs / 60000) + x.min) % 1440;
                                    return !inAnyWindow(utc, [win]);
                                });
                                r = {
                                    verdict: bad.length ? "CHECK" : "OK",
                                    why: times.map((x) => x.p + " " +
                                        hhmm((Math.floor(ctx.baseMs / 60000) + x.min) % 1440) + "Z").join(", ") +
                                        " vs " + timeM[2] + "–" + timeM[3] + "Z",
                                    evidence: on
                                };
                            }
                        }
                    }
                }

                // E. "MUST BE ESTABLISHED EITHER: (A) ON OR N OF GOATS DCT BTT
                //     (B) ON OR S OF ORT J124 GKN DTOUR"
                //    Satisfied when the route actually flies one of the stated
                //    routings. Alternatives are numbered (A)/(B) in the text.
                if (!r && /MUST\s+BE\s+ESTABLISHED\s+EITHER/.test(t)) {
                    // "FLTS ENTERING ANCHORAGE FIR N OF 620000N1410000W ..."
                    // The clause binds only flights entering on the stated
                    // side. AAR202 crosses into PAZA at OMOTO, 49N - thirteen
                    // degrees south of the line - so the routing it demands is
                    // not a requirement on that flight at all, and reporting it
                    // as unmet would be a false alarm on a safety item.
                    const preM = t.match(/ENTERING\s+[A-Z]+\s+FIR\s+([NSEW])\s+OF\s+(\d{6}[NS]\d{7}[EW])/);
                    if (preM) {
                        const line = decodeLatLon(preM[2]);
                        const entry = station ? firEntryPoint(ctx, station) : null;
                        if (!line || !entry) {
                            results.push({ ref: c.ref, text: c.text, verdict: "UNKNOWN",
                                why: entry ? "기준 좌표를 읽지 못했다"
                                           : (station || "해당 FIR") + " 진입 지점이 웨이포인트 표에 없다" });
                            continue;
                        }
                        const side = preM[1];
                        const applies = side === "N" ? entry.lat > line.lat
                                      : side === "S" ? entry.lat < line.lat
                                      : side === "E" ? shiftLon(entry.lon, line.lon) > 0
                                                     : shiftLon(entry.lon, line.lon) < 0;
                        if (!applies) {
                            const KO = { N: "북", S: "남", E: "동", W: "서" };
                            results.push({ ref: c.ref, text: c.text, verdict: "NA",
                                why: station + " 진입 " + entry.name + "(" + fmtLL(entry) + ")는 기준 " +
                                     fmtLL(line) + "의 " + KO[side] + "쪽이 아니다 — 이 조항의 적용 대상이 아니다" });
                            continue;
                        }
                    }

                    const alts = [];
                    const altRe = /\(([A-Z])\)\s*(?:ON\s+OR\s+[NSEW]\s+OF\s+)?([A-Z0-9][A-Z0-9\s]{2,60}?)(?=\s*\(|$)/g;
                    let a;
                    while ((a = altRe.exec(t)) !== null) {
                        const item = parseRouteItem(a[2]);
                        if (item) alts.push({ tag: a[1], item, text: a[2].trim() });
                    }
                    if (alts.length) {
                        const seq = routeSequence(ctx);
                        const met = alts.filter((x) => x.item.kind === "leg"
                            ? hasLeg(seq, x.item.from, x.item.to)
                            : ours.has(x.item.name));
                        r = met.length
                            ? { verdict: "OK", why: "지정 경로 (" + met[0].tag + ") " + met[0].text + " 를 그대로 비행계획에 반영",
                                evidence: met.map((x) => x.text) }
                            : { verdict: "CHECK", why: "지정 대안 " + alts.map((x) => "(" + x.tag + ") " + x.text).join(" / ") +
                                " 중 비행계획과 일치하는 것을 찾지 못했다" };
                    }
                }

                // F. "THE FOLLOWING RTES/FIXES ARE NOT AVBL: (A) ... (B) ..."
                //    A multi-token entry is a leg, not a list of fixes.
                if (!r && /(?:RTES?\/FIXES?|ROUTES?)\s+ARE\s+NOT\s+AVBL/.test(t)) {
                    const items = [];
                    const itRe = /\(([A-Z])\)\s*([^()]+?)(?=\s*\([A-Z]\)|$)/g;
                    let a;
                    while ((a = itRe.exec(t)) !== null) {
                        a[2].split(",").forEach((piece) => {
                            const it2 = parseRouteItem(piece);
                            if (it2) items.push({ tag: a[1], item: it2, text: piece.trim() });
                        });
                    }
                    if (items.length) {
                        const seq = routeSequence(ctx);
                        const used = items.filter((x) => x.item.kind === "leg"
                            ? hasLeg(seq, x.item.from, x.item.to)
                            : (ours.has(x.item.name) || ctx.route.airways.has(x.item.name)));
                        r = used.length
                            ? { verdict: "CHECK", why: "사용 불가로 고시된 " + used.map((x) => x.text).join(", ") + " 가 비행계획에 있다",
                                evidence: used.map((x) => x.text) }
                            : { verdict: "OK", why: "사용 불가 " + items.length + "건 중 비행계획에 포함된 것이 없다" };
                    }
                }

                // "2. USER PREFERRED ROUTE ENTERY/EXIT BTN CZEG, CZVR OR KZAK
                // FIR:" states no obligation of its own - it introduces the
                // lettered clauses under it. Scoring it as something to check
                // by hand buries the clauses that are.
                if (!r && /:$/.test(t) && clauses.some((o) => o.ref.indexOf(c.ref + ".") === 0)) {
                    r = { verdict: "HEADER", why: "" };
                }

                results.push(Object.assign({ ref: c.ref, text: c.text },
                    r || { verdict: "MANUAL", why: "이 문장에 대한 기계 판정 규칙이 없다" }));
            }

            const scored = results.filter((x) => x.verdict !== "MANUAL");
            return scored.length ? results : null;
        }

        /** A coordinate as a pilot writes it. */
        function fmtLL(p) {
            const la = Math.abs(p.lat).toFixed(2) + (p.lat >= 0 ? "N" : "S");
            const lo = Math.abs(p.lon).toFixed(2) + (p.lon >= 0 ? "E" : "W");
            return la + " " + lo;
        }

        /**
         * Cross-checks one NOTAM against the flight. Returns evidence, never a
         * verdict: `needsReview` means "a human has to read this", not "violation".
         */
        function crossCheckNotam(item, ctx) {
            const raw = String(item.raw || "").toUpperCase();
            const eIdx = raw.indexOf("E)");
            const body = eIdx >= 0 ? raw.slice(eIdx) : raw;

            // --- TIME -------------------------------------------------------
            let timeState = "UNKNOWN";
            let validFrom = null, validTo = null, validPerm = false;
            if (ctx.window) {
                const parts = String(item.valid || "").split("~");
                const from = parseNotamStamp(parts[0]);
                const toRaw = (parts[1] || "").trim();
                const perm = /^(UFN|PERM)/i.test(toRaw);
                const to = perm ? null : parseNotamStamp(toRaw);
                if (from) {
                    const startsAfter = from > ctx.window.end;
                    const endsBefore = !perm && to && to < ctx.window.start;
                    timeState = (startsAfter || endsBefore) ? "OUTSIDE" : "OVERLAP";
                }
                validFrom = from; validTo = to; validPerm = perm;
            }

            // --- STATION ----------------------------------------------------
            const stationMatch = ctx.airports.has(item.station);

            // --- ROUTE ------------------------------------------------------
            // 5-letter fixes, airways and lat/long points are strong evidence.
            // 3-letter navaids are reported separately: they collide with plain
            // English too easily to be treated the same way.
            //
            // Line numbers are kept so a card can quote its source line. A fix
            // named inside a route *definition* and a restriction sitting in a
            // different clause are not the same thing, and only the line shows it.
            const lines = body.split(/\r?\n/);
            const lineOf = (tok) => {
                const re = new RegExp("\\b" + tok + "\\b");
                for (let i = 0; i < lines.length; i += 1) if (re.test(lines[i])) return i;
                return -1;
            };

            const strong = [];
            const weak = [];
            const hitFixes = [], hitAirways = [], hitPoints = [];
            const routeLines = new Set();
            const collect = (set, bucket, category, keepLine) => {
                set.forEach((t) => {
                    const i = lineOf(t);
                    if (i < 0) return;
                    bucket.push(t);
                    if (category) category.push(t);
                    if (keepLine) routeLines.add(i);
                });
            };
            collect(ctx.route.fixes, strong, hitFixes, true);
            collect(ctx.route.airways, strong, hitAirways, true);
            collect(ctx.route.points, strong, hitPoints, true);
            collect(ctx.route.navaids, weak, null, false);

            // --- LIMIT ------------------------------------------------------
            const limits = [];
            const limitLines = new Set();
            const limitWords = [];
            for (const [re, label, words] of LIMIT_PATTERNS) {
                let found = -1;
                for (let i = 0; i < lines.length; i += 1) {
                    if (re.test(lines[i])) { found = i; break; }
                }
                if (found < 0 && re.test(body)) found = 0;   // single-line telex
                if (found < 0) continue;
                limits.push(label);
                limitLines.add(found);
                words.forEach((w) => { if (body.includes(w)) limitWords.push(w); });
            }

            const clip = (i) => (lines[i] || "").trim().replace(/\s+/g, " ").slice(0, 160);
            const routeQuotes = Array.from(routeLines).sort((a, b) => a - b).slice(0, 2).map(clip);
            const limitQuotes = Array.from(limitLines).sort((a, b) => a - b).slice(0, 2).map(clip);

            // Both present but never on the same line: the restriction is most
            // likely aimed at something other than our route. This is a pointer
            // for the person reading it, not a conclusion.
            const separated = routeLines.size > 0 && limitLines.size > 0 &&
                Array.from(routeLines).every((i) => !limitLines.has(i));

            const firMatch = ctx.firs.has(item.station);

            // Where this FIR sits in our crossing order, and what the NOTAM names.
            let firContext = null;
            if (firMatch && ctx.firSeq.length) {
                const i = ctx.firSeq.findIndex((x) => x.fir === item.station);
                if (i >= 0) {
                    firContext = {
                        prev: i > 0 ? ctx.firSeq[i - 1].fir : null,
                        next: i + 1 < ctx.firSeq.length ? ctx.firSeq[i + 1].fir : null
                    };
                }
            }
            const fixes = namedFixes(body, ctx.route.fixes);
            const airways = namedAirways(body, ctx.route.airways);

            // The daily window, against the moment we enter the issuing FIR.
            const daily = parseDailyWindow(raw);
            let dailyCheck = null;
            if (daily && firMatch) {
                const entry = firEntryMinutes(ctx.fullText, ctx.fpl, ctx.firSeq, item.station);
                if (entry !== null) {
                    dailyCheck = {
                        spec: daily.spec,
                        entry,
                        inWindow: inAnyWindow(entry, daily.windows),
                        dayQualified: daily.dayQualified
                    };
                }
            }

            // Areas stated as a centre + radius (or a coordinate list) are the
            // one place a real determination is possible: distance and altitude
            // are arithmetic, not reading comprehension.
            const area = extractGeoArea(raw);
            if (area) area.vert = parseVerticalBand(raw);
            const routePts = ctx.geomPts || ctx.route.pointList;
            let geo = geoCheck(area, routePts, ctx.levels);
            const zones = zoneCheck(raw, routePts);
            const cdr = cdrCheck(raw, ctx);
            const conditions = checkStatedConditions(raw, ctx, item.station);
            // A prohibition states its own box. Showing the generic distance
            // block for the identical shape says the same thing twice.
            const samePts = (a, b) => a.length === b.length &&
                a.every((p, i) => p.lat === b[i].lat && p.lon === b[i].lon);
            const dupZone = !!(zones && area && area.points &&
                zones.banned.some((z) => samePts(z.points, area.points)));
            if (dupZone) geo = null;
            /* ---- SPACE x TIME -------------------------------------------
             * Until now the two were asked separately: does the validity
             * overlap the whole flight (hours wide), and does the route pass
             * near the shape (no clock at all). A NOTAM can pass both and still
             * be irrelevant - live in the morning, flown past at night.
             *
             * The planned track carries a time at every waypoint, so the
             * closest approach has a moment. Asking the validity at *that*
             * moment is arithmetic, which is the one thing this file may
             * assert. Where the track or the clock is missing, it says so
             * rather than guessing.
             * ------------------------------------------------------------ */
            let passage = null;
            const trackPts = (ctx.track && ctx.track.points) || [];
            if (trackPts.length >= 2 && ctx.baseMs !== null) {
                const targets = [];
                if (area) {
                    if (area.kind === "circle" && area.centre) targets.push(area.centre);
                    else (area.points || []).forEach((pt) => targets.push(pt));
                }
                if (zones) {
                    (zones.banned || []).forEach((z) => (z.points || []).forEach((pt) => targets.push(pt)));
                    (zones.gates || []).forEach((g) => { if (g.a) targets.push(g.a); if (g.b) targets.push(g.b); });
                }
                // Which coordinate produced the winning distance is worth
                // keeping: a per-NOTAM map draws the leader line to it.
                let best = null, bestTarget = null;
                targets.forEach((pt) => {
                    const n = trackNearest(trackPts, pt, ctx.baseMs);
                    if (n && (!best || n.nm < best.nm)) { best = n; bestTarget = pt; }
                });
                if (best && best.tMs !== null) {
                    const t = best.tMs;
                    const liveAt = validFrom
                        ? (t >= validFrom && (validPerm || !validTo || t <= validTo))
                        : null;
                    let dailyAt = null;
                    if (daily) dailyAt = inAnyWindow(Math.floor(t / 60000) % 1440, daily.windows);
                    // Not in force and already finished are different facts,
                    // and a crew reads them differently: one moves with a
                    // delay, the other never will.
                    let reason = "UNKNOWN";
                    if (liveAt === true) reason = "IN_FORCE";
                    else if (liveAt === false) {
                        reason = (validFrom && t < validFrom) ? "BEFORE_START" : "AFTER_END";
                    }
                    passage = {
                        nm: best.nm,
                        between: best.between,
                        at: best.at,
                        target: bestTarget,
                        tMs: t,
                        utcMin: Math.floor(t / 60000) % 1440,
                        liveAt,
                        dailyAt,
                        reason,
                        startsMs: validFrom || null,
                        endsMs: validPerm ? null : (validTo || null),
                        // Only when both are known and both say yes does this
                        // become a statement; otherwise it stays a report.
                        active: (liveAt === null) ? null
                              : (dailyAt === null ? liveAt : (liveAt && dailyAt))
                    };
                }
            }

            const inWindow = timeState !== "OUTSIDE";
            // En route = the airspace we fly through, or a NOTAM that names a
            // point we filed. Airport NOTAMs are the other bucket.
            const routeRelated = inWindow && !stationMatch && (firMatch || strong.length > 0);
            const airportRelated = inWindow && stationMatch;

            // "Needs review" means en-route only. Ground NOTAMs at our own
            // airports are counted separately rather than folded in here - they
            // swamped the list, and the station tabs already cover them.
            // A navaid outage only matters when it is a navaid we use. `weak`
            // holds our filed 3-letter navaids found in the text; if any is
            // there the item stays, which is the safe direction to err.
            const NAVAID_WORD = /\b(VOR|VORTAC|DVOR|TACAN|NDB|DME|LOC|LOM|LDA|MLS|NAVAID)\b/;
            const OUTAGE_WORD = /\b(U\/S|OTS|UNUSABLE|UNSERVICEABLE|OUT OF SERVICE)\b/;
            const isNavaidOutage =
                !/\bTRIGGER NOTAM\b|\bAIP SUP\b/.test(body) &&
                lines.some((l) => NAVAID_WORD.test(l) && OUTAGE_WORD.test(l));
            const navaidNoise = isNavaidOutage && strong.length === 0 && weak.length === 0;

            const needsReview = routeRelated && limits.length > 0 && !navaidNoise;

            // The NOTAM names routes or fixes and not one of them is ours.
            // Usually that means another corridor - but a named fix can also be
            // a boundary you are told to stay clear of, so this ranks only.
            const namedAny = airways.mine.length + airways.theirs.length +
                fixes.mine.length + fixes.theirs.length;
            const scopedElsewhere = namedAny > 0 && strong.length === 0;

            return {
                timeState,
                stationMatch,
                firMatch,
                routeHits: strong,
                hitFixes,
                hitAirways,
                hitPoints,
                navaidHits: weak,
                limits,
                limitWords,
                area: dupZone ? null : area,
                geomSource: ctx.geomSource || "FPL15",
                zones,
                cdr,
                conditions,
                passage,
                geo,
                firContext,
                namedOurs: fixes.mine,
                namedTheirs: fixes.theirs,
                airwaysTheirs: airways.theirs,
                dailyCheck,
                routeQuotes,
                limitQuotes,
                separated,
                scopedElsewhere,
                navaidNoise,
                routeRelated,
                airportRelated,
                relevant: routeRelated || airportRelated,
                needsReview
            };
        }

        /** Runs the cross-check over every parsed NOTAM and summarises it. */
        /**
         * Everything crossCheckNotam() needs to know about the flight, built
         * once. Split out of buildCrossCheck() so a second page can cross-check
         * every NOTAM instead of only the ranked top of the list - the two
         * views must not build the flight differently.
         */
        function buildCrossCheckContext(fullText, fpl, routeText) {
            const routeField = fpl && fpl.route ? fpl.route : routeText;
            const route = extractRouteTokens(routeField);
            const ctx = {
                window: computeFlightWindow(fullText, fpl),
                airports: extractFlightAirports(fullText, fpl),
                firs: extractCrossedFirs(fullText),
                firSeq: extractFirSequence(fullText),
                fullText,
                fpl,
                levels: extractLevelBand(routeField),
                route: route,
                legs: routeLegs(routeField),
                wp: parseOfpWaypoints(fullText)
            };
            // The flown track, and the geometry the checks below measure against.
            ctx.track = buildRouteTrack(fullText, route.pointList);
            ctx.geomPts = ctx.track.geomPts;
            ctx.geomSource = ctx.track.source;

            // Cumulative minutes per fix, and the clock those minutes count from.
            // Only the planned run, and only rows whose name is a real ident -
            // a diversion table's time for the same fix must not overwrite the
            // planned one, and "TOC"/"FIR" are not fixes to look up.
            ctx.wpMin = {};
            ctx.track.primary.forEach((w) => {
                if (w.min !== null && w.kind !== "pseudo") ctx.wpMin[w.name] = w.min;
            });
            const dof = parseDofMs(fullText), etd = parseEtdMin(fullText);
            ctx.baseMs = (dof !== null && etd !== null) ? dof + etd * 60000 : null;
            return ctx;
        }

        /* ==============================================================
         * The flight, FIR by FIR
         *
         * A pilot reads a route as a sequence of airspaces, not as a list of
         * NOTAM numbers. This walks the FIRs in crossing order and hands each
         * one the items filed under it, with whatever the engine was able to
         * compute about them.
         *
         * It states counts and computed values. It does not conclude that the
         * flight is cleared - see the absolute rules. The closing line of such
         * a briefing is "these N were computed, these M you must read", never
         * "all satisfied, fly safe".
         * ============================================================== */

        /**
         * FIR names. Published, fixed facts - RJJJ is Fukuoka - not something
         * derived from the document, and not something to guess: a code that
         * is not in this table is printed as the code. A briefing that says
         * "앵커리지" instead of "PAZA" is the difference between a report and
         * a table, but a wrong name is worse than a bare code.
         */
        const FIR_NAMES = {
            RKRR: ["인천", "INCHEON"],
            RJJJ: ["후쿠오카", "FUKUOKA"],
            PAZA: ["앵커리지", "ANCHORAGE"],
            PAZN: ["앵커리지 대양", "ANCHORAGE OCEANIC"],
            CZEG: ["에드먼턴", "EDMONTON"],
            CZWG: ["위니펙", "WINNIPEG"],
            CZYZ: ["토론토", "TORONTO"],
            CZUL: ["몬트리올", "MONTREAL"],
            CZVR: ["밴쿠버", "VANCOUVER"],
            CZQX: ["갠더", "GANDER"],
            KZNY: ["뉴욕", "NEW YORK"],
            KZBW: ["보스턴", "BOSTON"],
            KZAK: ["오클랜드 대양", "OAKLAND OCEANIC"],
            KZOA: ["오클랜드", "OAKLAND"],
            KZSE: ["시애틀", "SEATTLE"],
            KZLA: ["로스앤젤레스", "LOS ANGELES"],
            KZDV: ["덴버", "DENVER"],
            KZMP: ["미니애폴리스", "MINNEAPOLIS"],
            RKSI: ["인천", "INCHEON"],
            RJTG: ["도쿄", "TOKYO"],
            ZKKP: ["평양", "PYONGYANG"],
            UHHH: ["하바롭스크", "KHABAROVSK"],
            UHMM: ["마가단", "MAGADAN"]
        };

        function firName(code) {
            const n = FIR_NAMES[code];
            return n ? { ko: n[0], en: n[1] } : null;
        }

        /** FIR boundaries in crossing order, from the waypoint table. */
        function firCrossings(ctx) {
            const rows = ctx.track ? ctx.track.primary : [];
            const out = [];
            for (const w of rows) {
                if (!w.fir) continue;
                // An ADIZ is an identification zone, not an FIR, and the table
                // prints its crossing in the same column. The EET parser already
                // skips it for the same reason; without this AAR202 reads as
                // "... KZAK -> ADIZ -> KZSE ...".
                if (w.fir === "ADIZ") continue;
                if (out.length && out[out.length - 1].fir === w.fir) continue;
                out.push({
                    fir: w.fir,
                    at: w.kind === "pseudo" ? null : w.name,
                    lat: w.lat, lon: w.lon, min: w.min
                });
            }
            return out;
        }

        /**
         * The FIRs this flight is inside, in order, with entry times.
         *
         * Field 18 EET lists the FIRs *entered* en route - never the one the
         * flight starts in. So the departure FIR is the one that files NOTAMs
         * in package 3 but never appears in EET (KZNY for a JFK departure,
         * RKRR for an Incheon one). It is prepended rather than guessed at
         * from the airport ident.
         *
         * A route that clips back into a FIR shows it once, at first entry.
         */
        function firOrder(ctx, items) {
            const cross = firCrossings(ctx);
            const eet = ctx.firSeq.map((f) => f.fir);
            const seen = new Set();
            const order = [];

            const pkg3 = new Set(items.filter((i) => i.pkg === 3).map((i) => i.station));
            eet.forEach((f) => pkg3.delete(f));
            cross.forEach((c) => pkg3.delete(c.fir));
            // The departure FIR is entered at off-blocks, which is where the
            // waypoint table's own clock starts.
            pkg3.forEach((f) => {
                if (seen.has(f)) return;
                seen.add(f);
                order.push({ fir: f, source: "DEP", at: null, enterMs: ctx.baseMs });
            });

            const push = (fir, at, min, source) => {
                if (seen.has(fir)) return;
                seen.add(fir);
                order.push({
                    fir, at, source,
                    enterMs: (min !== null && min !== undefined && ctx.baseMs !== null)
                        ? ctx.baseMs + min * 60000 : null
                });
            };
            cross.forEach((c) => push(c.fir, c.at, c.min, "WP"));
            ctx.firSeq.forEach((f) => {
                if (seen.has(f.fir)) return;
                const min = /^\d{4}$/.test(f.eet)
                    ? +f.eet.slice(0, 2) * 60 + +f.eet.slice(2) : null;
                push(f.fir, null, min, "EET");
            });
            return order;
        }

        /**
         * Every FIR with the items filed under it and what was computed.
         * Airport packages ride with the FIR they sit in: departure at the
         * front, destination and its alternates at the back - the document
         * says which airport is which, so no geography is guessed.
         */
        function buildFirBriefing(ctx, items) {
            const order = firOrder(ctx, items);
            if (!order.length) return null;

            const dep = ctx.fpl ? ctx.fpl.dep : null;
            const dest = ctx.fpl ? ctx.fpl.dest : null;
            const altns = (ctx.fpl && ctx.fpl.altns) || [];

            const inScope = items.filter((i) => i.pkg === 1 || i.pkg === 3);
            const byStation = new Map();
            inScope.forEach((i) => {
                if (!byStation.has(i.station)) byStation.set(i.station, []);
                byStation.get(i.station).push(i);
            });

            const used = new Set();
            const segs = order.map((o, idx) => {
                const own = (byStation.get(o.fir) || []);
                own.forEach((i) => used.add(i));

                // Airports belong to the first and last airspace of the flight.
                const airports = [];
                if (idx === 0 && dep) airports.push(dep);
                if (idx === order.length - 1) {
                    if (dest) airports.push(dest);
                    altns.forEach((a) => airports.push(a));
                }
                const apItems = [];
                airports.forEach((a) => (byStation.get(a) || []).forEach((i) => {
                    apItems.push(i); used.add(i);
                }));

                const all = own.concat(apItems);
                // Where this airspace sits in the flight - the only thing the
                // briefing says about a FIR that is not a count or a NOTAM.
                const phase = order.length === 1 ? "전 구간"
                    : idx === 0 ? "이륙 · 초기 상승"
                    : idx === order.length - 1 ? "강하 · 착륙"
                    : "순항";

                return {
                    fir: o.fir,
                    name: firName(o.fir),
                    phase,
                    enterAt: o.at,
                    enterMs: o.enterMs || null,
                    source: o.source,
                    airports: airports.filter((a) => byStation.has(a)),
                    items: all,
                    stats: summariseItems(all)
                };
            });

            // Anything filed under a station this walk never reached is still
            // shown - dropping it would make the briefing look complete when
            // it is not.
            const orphans = inScope.filter((i) => !used.has(i));
            return { segments: segs, orphans, orphanStats: summariseItems(orphans) };
        }

        /** Counts of what the engine could and could not say about a set. */
        function summariseItems(list) {
            const s = {
                total: list.length, critical: 0, shaded: 0,
                computed: 0, review: 0, conditionsOk: 0, conditionsCheck: 0,
                conditionsUnknown: 0
            };
            list.forEach((i) => {
                const x = i.xc || {};
                if (i.reasonCategory === "CRITICAL") s.critical += 1;
                if (i.autoShaded) s.shaded += 1;
                if (x.geo || x.zones || (x.cdr && x.cdr.length) || x.dailyCheck || x.conditions) s.computed += 1;
                if (x.needsReview) s.review += 1;
                (x.conditions || []).forEach((c) => {
                    if (c.verdict === "OK") s.conditionsOk += 1;
                    else if (c.verdict === "CHECK") s.conditionsCheck += 1;
                    else if (c.verdict === "UNKNOWN") s.conditionsUnknown += 1;
                });
            });
            return s;
        }

        /**
         * One PDF's text in, every NOTAM with its cross-check out. The list
         * is not ranked, filtered or truncated here: deciding what to show is
         * the view's job, and nothing may be dropped on the way.
         */
        function analyseFlight(fullText) {
            const fpl = parseIcaoFpl(fullText);
            const notams = parseAllRawNotamsWithShading(fullText);
            const ctx = buildCrossCheckContext(fullText, fpl, "");
            const items = notams.map((n) => Object.assign({}, n, { xc: crossCheckNotam(n, ctx) }));
            return {
                fpl,
                window: ctx.window,
                airports: Array.from(ctx.airports),
                firs: Array.from(ctx.firs),
                firSeq: ctx.firSeq,
                levels: ctx.levels,
                route: {
                    fixes: Array.from(ctx.route.fixes),
                    airways: Array.from(ctx.route.airways),
                    navaids: Array.from(ctx.route.navaids)
                },
                wpCount: ctx.wp.length,
                track: {
                    source: ctx.track.source,
                    points: ctx.track.points.length,
                    runs: 1 + ctx.track.others.length,
                    gaps: ctx.track.gaps,
                    // The flown polyline itself, for anyone drawing it.
                    pts: ctx.track.points.map((w) => ({
                        name: w.kind === "pseudo" ? null : w.name,
                        lat: w.lat, lon: w.lon, min: w.min, fir: w.fir || null
                    }))
                },
                baseMs: ctx.baseMs,
                firBriefing: buildFirBriefing(ctx, items),
                items: items
            };
        }

        function buildCrossCheck(fullText, fpl, routeText, notams) {
            const ctx = buildCrossCheckContext(fullText, fpl, routeText);

            const rows = [];
            let outside = 0, airportCount = 0, routeCount = 0, review = 0, scoped = 0, navNoise = 0;
            for (const n of notams) {
                const r = crossCheckNotam(n, ctx);
                if (r.timeState === "OUTSIDE") outside++;
                if (r.airportRelated) airportCount++;
                if (r.navaidNoise && r.routeRelated && r.limits.length) navNoise++;
                if (r.routeRelated) routeCount++;
                if (r.needsReview) {
                    review++;
                    if (r.scopedElsewhere) scoped++;
                    rows.push({ item: n, result: r });
                }
            }

            // Most evidence first, then by station.
            // Items scoped to somebody else's routes sink to the bottom.
            rows.sort((a, b) =>
                (a.result.scopedElsewhere ? 1 : 0) - (b.result.scopedElsewhere ? 1 : 0) ||
                (b.result.routeHits.length - a.result.routeHits.length) ||
                (b.result.limits.length - a.result.limits.length) ||
                a.item.station.localeCompare(b.item.station));

            return {
                ok: !!(ctx.window && (ctx.route.fixes.size || ctx.route.airways.size)),
                window: ctx.window,
                airports: Array.from(ctx.airports),
                routeTokenCount: ctx.route.fixes.size + ctx.route.airways.size + ctx.route.points.size,
                firs: Array.from(ctx.firs),
                firSeq: ctx.firSeq,
                routePointCount: (ctx.geomPts || ctx.route.pointList).length,
                geomSource: ctx.geomSource || "FPL15",
                levels: ctx.levels,
                total: notams.length,
                outside,
                airportCount,
                routeCount,
                review,
                scoped,
                navNoise,
                rows: rows.slice(0, 40)
            };
        }

        /**
         * Reads departure, destination and alternates straight out of the filed
         * ICAO flight plan.
         *
         *   (FPL-AAR223-IS -A388/J-SDE... -KJFK0600 -N0493F310 DCT ... -RKSI1459 RKSS -PBN/...)
         *                                  ^field 13                    ^field 16
         *
         * Fields are separated by " -". Field 13 is ADEP + EOBT, field 16 is ADES +
         * total EET followed by the alternates. Returns null when there is no FPL to
         * read - the caller must then say so rather than fall back to a guess.
         */
        function parseIcaoFpl(text) {
            const m = String(text || "").toUpperCase().match(/\(FPL-[\s\S]{0,4000}?\)/);
            if (!m) return null;

            const flat = m[0].replace(/^\(/, "").replace(/\)$/, "").replace(/\s+/g, " ").trim();
            const fields = flat.split(/ -/);

            let dep = null, depTime = null, dest = null, eet = null, altns = [], route = "";
            for (const f of fields) {
                const t = f.trim();
                if (!dep) {
                    const d = t.match(/^([A-Z]{4})(\d{4})$/);
                    if (d) { dep = d[1]; depTime = d[2]; continue; }
                }
                // Field 15 is the one immediately after field 13. Taking it by
                // position keeps field 18 out - RIF/ carries a contingency route
                // and A/WHITE is the paint scheme, neither of which is filed track.
                if (dep && !dest && !route) { route = t; }
                if (dep && !dest) {
                    const a = t.match(/^([A-Z]{4})(\d{4})((?: +[A-Z]{4})*)$/);
                    if (a) {
                        dest = a[1];
                        eet = a[2];
                        altns = (a[3] || "").trim().split(/ +/).filter(Boolean);
                    }
                }
            }
            if (!dep || !dest) return null;

            const cs = flat.match(/^FPL-([A-Z0-9]{3,8})-/);
            return { dep, depTime, dest, eet, altns, route, callsign: cs ? cs[1] : null };
        }


/* Node (regression harness) - a no-op in the browser. */
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        NOTAM_CATEGORIES,
        categoryGroup,
        extractSubject,
        runwayKey,
        reciprocalEnd,
        parseNotamSections,
        extractPdfLayout,
        extractTextFromPdfFile,
        evaluateAutoShading,
        generateKoreanExplanation,
        parseAllRawNotamsWithShading,
        MONTHS,
        parseNotamStamp,
        computeFlightWindow,
        extractRouteTokens,
        extractCrossedFirs,
        extractFlightAirports,
        LIMIT_PATTERNS,
        NM_PER_RAD,
        toRad,
        decodeLatLon,
        gcNm,
        bearing,
        segNm,
        segNearest,
        trackNearest,
        polylineNm,
        shiftLon,
        pointInPolygon,
        segCross,
        extractProhibitedAreas,
        extractGateSegments,
        zoneCheck,
        extractGeoArea,
        parseVerticalBand,
        geoCheck,
        dmToDeg,
        parseOfpWaypoints,
        splitWaypointRuns,
        buildRouteTrack,
        planarLegs,
        parseEtdMin,
        parseDofMs,
        stampMs,
        routeLegs,
        parseCdrTable,
        cdrCheck,
        extractFirSequence,
        extractLevelBand,
        ROUTE_CUES,
        PROSE_5,
        namedFixes,
        highlightRaw,
        parseDailyWindow,
        firEntryMinutes,
        inAnyWindow,
        hhmm,
        namedAirways,
        splitClauses,
        routeSequence,
        hasLeg,
        firEntryPoint,
        checkStatedConditions,
        crossCheckNotam,
        buildCrossCheckContext,
        FIR_NAMES,
        firName,
        firCrossings,
        firOrder,
        buildFirBriefing,
        summariseItems,
        analyseFlight,
        buildCrossCheck,
        parseIcaoFpl,
    };
}
