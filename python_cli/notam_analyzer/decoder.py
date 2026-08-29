"""
ICAO NOTAM Abbreviations & Natural Language Decoder
Translates raw aviation abbreviations into Korean natural language explanations and operational impacts.
"""

import re
from typing import Dict, Tuple

# ICAO standard abbreviations dictionary
ICAO_ABBREVIATIONS: Dict[str, str] = {
    # Status & Operations
    "CLSD": "폐쇄 (Closed)",
    "CLOSED": "폐쇄 (Closed)",
    "U/S": "운용 불능 (Unserviceable)",
    "OTS": "운용 중단 (Out of Service)",
    "WIP": "공사/작업 진행 중 (Work In Progress)",
    "AVBL": "사용 가능 (Available)",
    "NOT AVBL": "사용 불가 (Not Available)",
    "UNAVBL": "사용 불가 (Unavailable)",
    "OPR": "운영 중 (Operated / In Operation)",
    "OPR HR": "운영 시간 (Operational Hours)",
    "MAINT": "정비/보수 (Maintenance)",
    "ACT": "활동/발효 중 (Active)",
    "AUTH": "인가/허가 (Authorized)",
    "UNAUTH": "미인가/불허 (Unauthorized)",
    "PROHIBITED": "금지됨 (Prohibited)",
    "RESTRICTED": "제한됨 (Restricted)",
    "SUSPENDED": "일시 중단 (Suspended)",
    "CHG": "변경 (Changed)",
    "REPL": "대체 (Replaced)",
    "EST": "추정 (Estimated)",
    "PERM": "영구 변경 (Permanent)",
    "TEMPO": "일시적 (Temporary)",
    "EXC": "~을 제외하고 (Except)",
    "BTN": "~사이에 (Between)",
    "DLY": "매일 (Daily)",
    "HJ": "일출부터 일몰까지 (Sunrise to Sunset)",
    "HN": "일몰부터 일출까지 (Sunset to Sunrise)",
    "H24": "24시간 운영 (Continuous Day/Night)",
    "HX": "특정 시간 제한 없음 (No Specific Working Hours)",
    "UFN": "추후 통보 시까지 (Until Further Notice)",
    "WEF": "~부터 발효 (With Effect From)",
    "TIL": "~까지 (Until)",
    
    # Runway & Surface
    "RWY": "활주로 (Runway)",
    "TWY": "유도로 (Taxiway)",
    "TXL": "유도로 진입선 (Taxilane)",
    "APRON": "계류장 (Apron/Ramp)",
    "STAND": "주기장 (Parking Stand)",
    "GATE": "탑승 게이트 (Gate)",
    "THR": "활주로 시단 (Threshold)",
    "DISP THR": "이설된 시단 (Displaced Threshold)",
    "CWY": "이륙활주로 연장부 (Clearway)",
    "SWY": "정지로 (Stopway)",
    "TORA": "이륙활주가용거리 (TORA)",
    "TODA": "이륙가용거리 (TODA)",
    "ASDA": "가속정지가용거리 (ASDA)",
    "LDA": "착륙가용거리 (LDA)",
    "RCLL": "활주로 중심선등 (Runway Centerline Lights)",
    "REDL": "활주로 등화 (Runway Edge Lights)",
    "RTIL": "활주로 시단 식별등 (Runway Threshold Identification Lights)",
    "TDZ": "접지대 (Touchdown Zone)",
    "TDZL": "접지대등 (Touchdown Zone Lights)",
    "FOD": "이물질 (Foreign Object Debris)",
    "BA": "제동 상태 (Braking Action)",
    "GRVD": "그루빙/홈 파임 처리 (Grooved)",
    "RUBBER DEP": "고무 침적 (Rubber Deposits)",
    
    # Lighting & Visual Aids
    "ALS": "진입등화시스템 (Approach Lighting System)",
    "ALSF": "고광도 진입등화 (ALSF)",
    "MALSF": "중광도 진입등화 (MALSF)",
    "MALSR": "중광도 진입등화 및 정렬등 (MALSR)",
    "SALS": "단축 진입등화 (Short ALS)",
    "SSALS": "단순 진입등화 (Simplified Short ALS)",
    "PAPI": "정밀진입각지시등 (PAPI)",
    "VASI": "시각진입경사지시등 (VASI)",
    "LGT": "등화/조명 (Light)",
    "LGTS": "등화 시설 (Lights)",
    "LGTD": "점등됨 (Lighted)",
    "UNLGTD": "소등/비점등 (Unlighted)",
    "FLG": "점멸등 (Flashing Light)",
    "WDI": "풍향지시기 (Wind Direction Indicator)",
    
    # NAVAIDs & Communications
    "ILS": "계기착륙시설 (Instrument Landing System)",
    "LOC": "방위각제공시설 (Localizer)",
    "GP": "활공각제공시설 (Glide Path)",
    "GS": "활공각 (Glide Slope)",
    "DME": "거리측정시설 (DME)",
    "VOR": "초단파전방향무선표지 (VOR)",
    "DVOR": "도플러 VOR (Doppler VOR)",
    "NDB": "무지향성표지 (NDB)",
    "TACAN": "전술항법장비 (TACAN)",
    "VORTAC": "VOR/TACAN 복합시설 (VORTAC)",
    "FREQ": "주파수 (Frequency)",
    "RADAR": "레이더 (Radar)",
    "SSR": "2차 감시 레이더 (SSR)",
    "PSR": "1차 감시 레이더 (PSR)",
    "ADS-B": "자동종속감시-방송 (ADS-B)",
    "ADS-C": "자동종속감시-계약 (ADS-C)",
    "CPDLC": "조종사-관제사 데이터링크 (CPDLC)",
    "ATIS": "공항정보자동방송 (ATIS)",
    "COMM": "통신 (Communication)",
    "CH": "채널 (Channel)",
    
    # Procedures & Navigation
    "IAP": "계기접근절차 (Instrument Approach Procedure)",
    "SID": "표준계기출발절차 (Standard Instrument Departure)",
    "STAR": "표준계기도착절차 (Standard Terminal Arrival)",
    "RNAV": "지역항법 (Area Navigation)",
    "RNP": "필수항행성능 (Required Navigation Performance)",
    "GPS": "위성항법 (GPS)",
    "GNSS": "글로벌 위성항행시스템 (GNSS)",
    "RAIM": "수신기 자율 무결성 감시 (RAIM)",
    "CAT I": "카테고리 1 정밀접근 (CAT I)",
    "CAT II": "카테고리 2 정밀접근 (CAT II)",
    "CAT III": "카테고리 3 정밀접근 (CAT III)",
    "SA CAT I": "특수인가 카테고리 1 (Special Auth CAT I)",
    "SA CAT II": "특수인가 카테고리 2 (Special Auth CAT II)",
    "DH": "결심고도 (Decision Height)",
    "DA": "결심고도 (Decision Altitude)",
    "MDA": "최저강하고도 (Minimum Descent Altitude)",
    "HAT": "접지대 상공 고도 (Height Above Touchdown)",
    "RVR": "활주로가시범위 (Runway Visual Range)",
    "VIS": "시정 (Visibility)",
    "MINIMA": "착륙 최저치 (Minima)",
    "MISSED APCH": "복행/실패접근절차 (Missed Approach)",
    "HOLDING": "공중 대기 절차 (Holding)",
    "MEATH": "최저항로고도 (MEA)",
    "MORA": "최저구역고도 (MORA)",
    "MVA": "최저레이더유도고도 (MVA)",
    
    # Obstacles & Hazards
    "OBST": "장애물 (Obstacle)",
    "CRANE": "기중기/크레인 (Crane)",
    "TOWER": "철탑/타워 (Tower)",
    "MAST": "마스트/돛대 (Mast)",
    "ELEV": "표고/해발고도 (Elevation)",
    "HGT": "지상고 (Height)",
    "AGL": "지표면 상공 (Above Ground Level)",
    "AMSL": "평균해수면 상공 (Above Mean Sea Level)",
    "MSL": "해수면 (Mean Sea Level)",
    "BIRD": "조류 (Bird)",
    "WILDLIFE": "야생동물 (Wildlife)",
    "VOLCANIC": "화산 (Volcanic)",
    "ASH": "화산재 (Ash)",
    "SMOKE": "연기 (Smoke)",
    "TURB": "난류 (Turbulence)",
    "ICING": "착빙 (Icing)",
    
    # General & Admin
    "ACFT": "항공기 (Aircraft)",
    "AD": "비행장 (Aerodrome)",
    "APT": "공항 (Airport)",
    "AIP": "항공정보간행물 (AIP)",
    "AIP SUP": "AIP 보충판 (AIP Supplement)",
    "AIRAC": "항공정보정기갱신체계 (AIRAC)",
    "TRIGGER NOTAM": "AIP 수록 알림 고시보 (Trigger NOTAM)",
    "NOTAMN": "신규 고시보 (New NOTAM)",
    "NOTAMR": "대체 고시보 (Replacement NOTAM)",
    "NOTAMC": "취소 고시보 (Cancellation NOTAM)",
    "COAD": "항공사 자체 고시보 (Company Advisory)",
    "FIR": "비행정보구역 (Flight Information Region)",
    "CTA": "관제구역 (Control Area)",
    "CTR": "관제권 (Control Zone)",
    "TMA": "터미널관제구역 (Terminal Control Area)",
    "MIL": "군용 (Military)",
    "CIV": "민간 (Civilian)",
    "VFR": "시계비행 (Visual Flight Rules)",
    "IFR": "계기비행 (Instrument Flight Rules)",
    "SFC": "지표면 (Surface)",
    "FL": "비행고도 (Flight Level)"
}

AIRPORT_DB: Dict[str, Dict[str, str]] = {
    "RKSI": {"iata": "ICN", "name": "인천국제공항 (Incheon Intl)", "country": "대한민국"},
    "RKSS": {"iata": "GMP", "name": "김포국제공항 (Gimpo Intl)", "country": "대한민국"},
    "RKPC": {"iata": "CJU", "name": "제주국제공항 (Jeju Intl)", "country": "대한민국"},
    "RKPK": {"iata": "PUS", "name": "김해국제공항 (Gimhae Intl)", "country": "대한민국"},
    "RKNY": {"iata": "YNY", "name": "양양국제공항 (Yangyang Intl)", "country": "대한민국"},
    "RKJB": {"iata": "MWX", "name": "무안국제공항 (Muan Intl)", "country": "대한민국"},
    "RKJJ": {"iata": "KWJ", "name": "광주공항 (Gwangju)", "country": "대한민국"},
    "RKPU": {"iata": "USN", "name": "울산공항 (Ulsan)", "country": "대한민국"},
    "RKJY": {"iata": "RSU", "name": "여수공항 (Yeosu)", "country": "대한민국"},
    "RKTU": {"iata": "CJJ", "name": "청주국제공항 (Cheongju Intl)", "country": "대한민국"},
    "RKTN": {"iata": "TAE", "name": "대구국제공항 (Daegu Intl)", "country": "대한민국"},
    
    "KJFK": {"iata": "JFK", "name": "뉴욕 존 F. 케네디 국제공항 (JFK Intl)", "country": "미국"},
    "KEWR": {"iata": "EWR", "name": "뉴어크 리버티 국제공항 (Newark Liberty)", "country": "미국"},
    "KLGA": {"iata": "LGA", "name": "뉴욕 라과디아 공항 (LaGuardia)", "country": "미국"},
    "KLAX": {"iata": "LAX", "name": "로스앤젤레스 국제공항 (Los Angeles Intl)", "country": "미국"},
    "KSFO": {"iata": "SFO", "name": "샌프란시스코 국제공항 (San Francisco Intl)", "country": "미국"},
    "KORD": {"iata": "ORD", "name": "시카고 오헤어 국제공항 (O'Hare Intl)", "country": "미국"},
    "KSEA": {"iata": "SEA", "name": "시애틀 터코마 국제공항 (Seattle-Tacoma)", "country": "미국"},
    "KBOS": {"iata": "BOS", "name": "보스턴 로건 국제공항 (Boston Logan)", "country": "미국"},
    "KIAD": {"iata": "IAD", "name": "워싱턴 덜레스 국제공항 (Washington Dulles)", "country": "미국"},
    "KATL": {"iata": "ATL", "name": "애틀랜타 하츠필드-잭슨 공항 (Atlanta)", "country": "미국"},
    "KDFW": {"iata": "DFW", "name": "댈러스 포트워스 국제공항 (Dallas/Fort Worth)", "country": "미국"},
    "KSAN": {"iata": "SAN", "name": "샌디에이고 국제공항 (San Diego Intl)", "country": "미국"},
    "PANC": {"iata": "ANC", "name": "앵커리지 테드 스티븐스 공항 (Ted Stevens ANC)", "country": "미국(알래스카)"},
    "PHNL": {"iata": "HNL", "name": "호놀룰루 다니엘 K. 이노우에 공항 (Honolulu)", "country": "미국(하와이)"},
    
    "RJTT": {"iata": "HND", "name": "도쿄 하네다 국제공항 (Tokyo Haneda)", "country": "일본"},
    "RJAA": {"iata": "NRT", "name": "도쿄 나리타 국제공항 (Tokyo Narita)", "country": "일본"},
    "RJBB": {"iata": "KIX", "name": "오사카 간사이 국제공항 (Kansai Intl)", "country": "일본"},
    "RJCC": {"iata": "CTS", "name": "삿포로 신치토세 공항 (New Chitose)", "country": "일본"},
    "RJGG": {"iata": "NGO", "name": "나고야 주부 센트레아 공항 (Chubu Centrair)", "country": "일본"},
    "ROAH": {"iata": "OKA", "name": "오키나와 나하 공항 (Naha)", "country": "일본"},
    "RJFF": {"iata": "FUK", "name": "후쿠오카 공항 (Fukuoka)", "country": "일본"},
    
    "ZBAA": {"iata": "PEK", "name": "베이징 서우두 국제공항 (Beijing Capital)", "country": "중국"},
    "ZBAD": {"iata": "PKX", "name": "베이징 다싱 국제공항 (Beijing Daxing)", "country": "중국"},
    "ZSPD": {"iata": "PVG", "name": "상하이 푸둥 국제공항 (Shanghai Pudong)", "country": "중국"},
    "ZSSS": {"iata": "SHA", "name": "상하이 훙차오 국제공항 (Hongqiao)", "country": "중국"},
    "ZGSZ": {"iata": "SZX", "name": "선전 바오안 국제공항 (Shenzhen Bao'an)", "country": "중국"},
    "ZGGG": {"iata": "CAN", "name": "광저우 바이윈 국제공항 (Guangzhou Baiyun)", "country": "중국"},
    "VHHH": {"iata": "HKG", "name": "홍콩 첵랍콕 국제공항 (Hong Kong Intl)", "country": "홍콩"},
    "VMMC": {"iata": "MFM", "name": "마카오 국제공항 (Macau Intl)", "country": "마카오"},
    "RCTP": {"iata": "TPE", "name": "타이베이 타오위안 국제공항 (Taoyuan Intl)", "country": "대만"},
    "RCSS": {"iata": "TSA", "name": "타이베이 쑹산 공항 (Songshan)", "country": "대만"},
    
    "WSSS": {"iata": "SIN", "name": "싱가포르 창이 국제공항 (Singapore Changi)", "country": "싱가포르"},
    "VTBS": {"iata": "BKK", "name": "방콕 수완나품 국제공항 (Suvarnabhumi)", "country": "태국"},
    "WMKK": {"iata": "KUL", "name": "쿠알라룸푸르 국제공항 (Kuala Lumpur Intl)", "country": "말레이시아"},
    "VVTS": {"iata": "SGN", "name": "호치민 떤선녓 국제공항 (Tan Son Nhat)", "country": "베트남"},
    "VVNB": {"iata": "HAN", "name": "하노이 노이바이 국제공항 (Noi Bai)", "country": "베트남"},
    "RPLL": {"iata": "MNL", "name": "마닐라 니노이 아키노 공항 (Ninoy Aquino)", "country": "필리핀"},
    "WIII": {"iata": "CGK", "name": "자카르타 수카르노 하타 공항 (Soekarno-Hatta)", "country": "인도네시아"},
    
    "EGLL": {"iata": "LHR", "name": "런던 히드로 공항 (London Heathrow)", "country": "영국"},
    "EGKK": {"iata": "LGW", "name": "런던 개트윅 공항 (London Gatwick)", "country": "영국"},
    "LFPG": {"iata": "CDG", "name": "파리 샤를 드골 공항 (Paris Charles de Gaulle)", "country": "프랑스"},
    "EDDF": {"iata": "FRA", "name": "프랑크푸르트 공항 (Frankfurt)", "country": "독일"},
    "EDDM": {"iata": "MUC", "name": "뮌헨 공항 (Munich)", "country": "독일"},
    "EHAM": {"iata": "AMS", "name": "암스테르담 스키폴 공항 (Amsterdam Schiphol)", "country": "네덜란드"},
    "LSZH": {"iata": "ZRH", "name": "취리히 공항 (Zurich)", "country": "스위스"},
    "LIRF": {"iata": "FCO", "name": "로마 피우미치노 공항 (Rome Fiumicino)", "country": "이탈리아"},
    "LEMD": {"iata": "MAD", "name": "마드리드 바라하스 공항 (Madrid-Barajas)", "country": "스페인"},
    "LEBL": {"iata": "BCN", "name": "바르셀로나 엘프라트 공항 (Barcelona-El Prat)", "country": "스페인"},
    "OMDB": {"iata": "DXB", "name": "두바이 국제공항 (Dubai Intl)", "country": "UAE"},
    "OTHH": {"iata": "DOH", "name": "도하 하마드 국제공항 (Hamad Intl)", "country": "카타르"},
    "OERK": {"iata": "RUH", "name": "리야드 킹 칼리드 공항 (King Khalid)", "country": "사우디아라비아"},
    "YSSY": {"iata": "SYD", "name": "시드니 킹스포드 스미스 공항 (Sydney)", "country": "호주"},
    "YMML": {"iata": "MEL", "name": "멜버른 툴라마린 공항 (Melbourne)", "country": "호주"},
    "NZAA": {"iata": "AKL", "name": "오클랜드 국제공항 (Auckland)", "country": "뉴질랜드"},
    "CYYZ": {"iata": "YYZ", "name": "토론토 피어슨 국제공항 (Toronto Pearson)", "country": "캐나다"},
    "CYVR": {"iata": "YVR", "name": "밴쿠버 국제공항 (Vancouver Intl)", "country": "캐나다"}
}

def get_airport_name(icao: str) -> str:
    if icao in AIRPORT_DB:
        return f"{AIRPORT_DB[icao]['name']} [{icao}]"
    return icao

def decode_icao_text(raw_text: str) -> str:
    decoded = raw_text
    decoded = re.sub(r'\bRWY\s+(\d{1,2}[LCR]?|\d{1,2}/\d{1,2}[LCR]?)\b', r'활주로(RWY \1)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bTWY\s+([A-Z0-9]+)\b', r'유도로(TWY \1)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\b(CLSD|CLOSED)\b', r'폐쇄(CLSD)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\b(U/S|OTS|OUT OF SERVICE)\b', r'운용불능(U/S)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bWIP\b', r'공사진행중(WIP)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bAVBL\b', r'사용가능(AVBL)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bUNAVBL\b', r'사용불가(UNAVBL)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bOBST\s+CRANE\b', r'장애물 크레인(OBST CRANE)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bPAPI\b', r'정밀진입각지시등(PAPI)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bALS\b', r'진입등화시스템(ALS)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bILS\b', r'계기착륙시설(ILS)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bLOC\b', r'로컬라이저(LOC)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bGP\b', r'글라이드패스(GP)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bBTN\b', r'~사이에(BTN)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bEXC\b', r'~제외(EXC)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bMAINT\b', r'정비점검(MAINT)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bTORA\b', r'이륙활주가용거리(TORA)', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'\bLDA\b', r'착륙가용거리(LDA)', decoded, flags=re.IGNORECASE)
    return decoded

def generate_korean_summary(station: str, category: str, raw_text: str) -> Tuple[str, str]:
    upper = raw_text.upper()
    station_name = AIRPORT_DB.get(station, {}).get("name", station)
    
    # 1. Taxiway (category is TAXIWAY)
    if category == "TAXIWAY":
        twy_m = re.search(r'(?:TWY|TAXIWAY|TXL)\s*([A-Z0-9\s,/-]+?)(?:\s+CLSD|\s+CLOSED|\s+BTN|\s+WIP)', upper)
        twy_str = f"유도로 {twy_m.group(1).strip()}" if twy_m else "지정 유도로"
        return (
            f"[{station}] {twy_str} 구간 공사/점검으로 폐쇄.",
            f"지상 활주(Taxi) 시 우회 경로 숙지 및 지상 관제 지시(Hold Short/Taxi Route) 철저 준수."
        )

    # 2. Runway Closures (category is RUNWAY)
    if category == "RUNWAY" and ("CLSD" in upper or "CLOSED" in upper):
        rwy_m = re.search(r'RWY\s*(\d{1,2}[LCR]?(?:/\d{1,2}[LCR]?)?)', upper)
        rwy_str = f"활주로 {rwy_m.group(1)}" if rwy_m else "해당 활주로"
        reason = "공사/정비" if "WIP" in upper or "MAINT" in upper else "운영 사유"
        return (
            f"[{station}] {rwy_str} {reason}로 인한 일시 폐쇄.",
            f"⚠️ 사용 가능 활주로(TORA/LDA) 사전 확인 및 출발/접근 브리핑 시 활주로 배정 상태 필히 재확인."
        )

    # 3. NAVAID / ILS (category is NAVAID)
    if category == "NAVAID" and any(k in upper for k in ["U/S", "OTS", "OUT OF SERVICE", "UNSERVICEABLE", "MAINT"]):
        nav_target = "ILS/LOC/GP"
        if "LOC" in upper and "GP" not in upper:
            nav_target = "로컬라이저 (LOC)"
        elif "GP" in upper or "GLIDE" in upper:
            nav_target = "글라이드패스 (GP)"
        elif "ILS" in upper:
            nav_target = "계기착륙장치 (ILS)"
        return (
            f"[{station}] {nav_target} 정비/결함으로 일시 운용 불능 (U/S).",
            f"🚨 정밀접근(CAT II/III) 불가 여부 확인, 비정밀접근(RNP/VOR/LOC Only) 최저치(Minima) 및 연료 대비."
        )

    # 4. Lighting (category is LIGHTING)
    if category == "LIGHTING":
        lgt_name = "등화 시설"
        if "PAPI" in upper:
            lgt_name = "정밀진입각지시등 (PAPI)"
        elif "ALS" in upper or "ALSF" in upper or "MALSR" in upper:
            lgt_name = "진입등화시스템 (ALS)"
        elif "RCLL" in upper:
            lgt_name = "활주로 중심선등 (RCLL)"
        return (
            f"[{station}] {lgt_name} 운용 불능 (U/S) 또는 점검 중.",
            f"야간/저시정 접근 시 시각 참조 제한 유의 및 기상 최저치(Vis/RVR) 증가 여부 점검."
        )

    # 5. Trigger NOTAM (AIP SUP / AIRAC)
    if "TRIGGER" in upper or "AIP SUP" in upper or "AIRAC" in upper:
        return (
            f"[{station}] AIP SUP / AIRAC 개정 사항 사전 고시 (Trigger NOTAM).",
            f"차트 개정판 기 반영 여부 확인 (일반 운항 시 추가 조치 불요)."
        )

    # 6. Obstacle / Crane
    if category == "OBSTACLE" or "CRANE" in upper or "OBST" in upper:
        hgt_m = re.search(r'(?:HGT|ELEV)\s*[:\s]*(\d+)\s*(?:FT|M)?', upper)
        hgt_str = f"(최고 높이 {hgt_m.group(1)}FT)" if hgt_m else ""
        return (
            f"[{station}] 공항 인근 크레인/구조물 장애물 설치 {hgt_str}.",
            f"이착륙 경로 상 장애물 여부 및 시계 접근 시 주의."
        )

    # 7. Bird Hazard
    if category == "HAZARD" or "BIRD" in upper or "WILDLIFE" in upper:
        return (
            f"[{station}] 공항 반경 내 조류 집중 서식/활동 주의보.",
            f"이착륙 시 윈드실드/엔진 조류 충돌(Bird Strike) 경계, 조명(Landing Light) 활용 점등 권장."
        )

    # 8. Procedures (SID / STAR / Approach / RNAV)
    if category == "PROCEDURE" or any(k in upper for k in ["SID", "STAR", "IAP", "RNAV", "RNP", "APPROACH", "MISSED"]):
        return (
            f"[{station}] 계기 비행 절차(SID/STAR/접근) 변경 또는 제한 고시.",
            f"최신 비행 차트(FMC 데이터베이스/Jeppesen Chart) 수정 사항 대조 및 최저 강하 고도 확인."
        )

    # 9. General Default
    return (
        f"[{station}] 운항 절차 및 공항 시설 관련 안내 고시.",
        f"해당 구역 통과 또는 비행 시 공항 운항 규정 준수."
    )
