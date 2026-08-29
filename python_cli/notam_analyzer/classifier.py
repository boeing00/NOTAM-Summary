"""
NOTAM Classification & Impact Filtering Engine
Categorizes NOTAMs into aviation operational areas and determines criticality (CRITICAL / CAUTION / INFO / SHADED).
"""

import re
from typing import Dict, Any, Tuple

class NotamClassifier:
    
    @staticmethod
    def classify_category(raw_text: str) -> str:
        """
        Determines the functional category of a NOTAM.
        Categories: RUNWAY, TAXIWAY, NAVAID, LIGHTING, OBSTACLE, PROCEDURE, RAMP, HAZARD, COMPANY, AIRSPACE
        """
        upper = raw_text.upper()
        
        # 1. Company Advisory
        if re.search(r'\b(COAD|COMPANY ADVISORY|COMPANY RADIO)\b', upper):
            return "COMPANY"

        # 2. Lighting (PAPI, ALS, Visual aids often mention RWY e.g. "RWY 24R PAPI U/S")
        if re.search(r'\b(PAPI|VASI|ALS|ALSF|MALSR|MALSF|SALS|SSALS|RCLL|REDL|RTIL|TDZL|APPROACH LIGHT|FLG LGT)\b', upper):
            return "LIGHTING"

        # 3. NAVAIDs / ILS (often mention RWY e.g. "ILS RWY 15R GP U/S")
        if re.search(r'\b(ILS|LOC|LOCALIZER|GP|GLIDE PATH|GLIDE SLOPE|DME|VOR|DVOR|NDB|TACAN|VORTAC|RADAR|SSR|PSR|FREQ|ATIS)\b', upper):
            return "NAVAID"

        # 4. Trigger & AIP
        if re.search(r'\b(TRIGGER NOTAM|AIP SUP|AIRAC)\b', upper):
            return "PROCEDURE"

        # 5. Obstacles & Cranes
        if re.search(r'\b(OBST|CRANE|TOWER|MAST|POLE|\bRIG\b|WIND TURBINE|PYLON)\b', upper):
            return "OBSTACLE"

        # 6. Taxiway (e.g. "TWY M1 CLSD BTN RWY 15L AND TWY R")
        if re.search(r'\b(TWY|TAXIWAY|TXL|TAXILANE|MXLC)\b', upper) and not re.search(r'\bRWY\s+\d{1,2}[LCR]?\s+(?:CLSD|CLOSED)\b', upper):
            return "TAXIWAY"

        # 7. Runway
        if re.search(r'\b(RWY|RUNWAY|TORA|TODA|ASDA|LDA|MRLC|MRAS|SURFACE CONDITIONS|BRAKING ACTION|RUBBER DEP)\b', upper):
            return "RUNWAY"

        # 8. Ramp / Apron / De-icing
        if re.search(r'\b(APRON|STAND|GATE|RAMP|DE-ICING|DEICING|BOARDING BRIDGE|PUSHBACK)\b', upper):
            return "RAMP"
            
        # 9. Environmental / Biological Hazards
        if re.search(r'\b(BIRD|WILDLIFE|VOLCANIC|ASH|SMOKE|FIRE|GRASS MOWING|FOG|SNOW|SLUSH|ICE)\b', upper):
            return "HAZARD"
            
        # 10. Flight Procedures
        if re.search(r'\b(SID|STAR|IAP|APPROACH|RNAV|RNP|MISSED APPROACH|HOLDING|TRANSITION|NOISE ABATEMENT|SPEED LIMIT|CONTINGENCY)\b', upper):
            return "PROCEDURE"
            
        # 11. Airspace / General
        if re.search(r'\b(AIRSPACE|FIR|RESTRICTED|PROHIBITED|DANGER AREA|CPDLC|ADS-C|ADS-B|RAIM)\b', upper):
            return "AIRSPACE"
            
        return "GENERAL"

    @staticmethod
    def evaluate_impact_and_shading(raw_text: str, category: str) -> Tuple[str, bool, str]:
        """
        Evaluates operational impact level (CRITICAL, CAUTION, INFO) and whether this NOTAM should be shaded (filtered as low priority).
        Returns: (level, is_shaded, shade_reason)
        """
        upper = raw_text.upper()
        
        # 1. Check Shading Criteria (Low Operational Impact / Informational Noise)
        is_shaded = False
        shade_reason = ""
        
        # Trigger / AIRAC / AIP SUP already incorporated in navigation charts
        if re.search(r'\b(TRIGGER NOTAM|AIP SUP|AIRAC)\b', upper):
            is_shaded = True
            shade_reason = "AIP SUP / AIRAC 최신 차트 기 반영 항목"
            
        # Specific non-relevant fleet (e.g. turboprop only, small aircraft, GA only)
        elif re.search(r'\b(TURBOPROP ONLY|SMALL ACFT ONLY|GA ONLY|CODE A ONLY|CODE B ONLY|HELICOPTER ONLY|HELI ONLY)\b', upper):
            is_shaded = True
            shade_reason = "소형기/헬기/타 기종 한정 (본 제트 여객기 비적용)"
            
        # Low altitude VFR or very low altitude crane (e.g., crane below 200ft far from RWY)
        elif re.search(r'\b(VFR ONLY|VFR TRANSITION|BELOW 1000FT|BELOW 500FT|BELOW 400FT)\b', upper):
            if "RWY" not in upper and "ILS" not in upper:
                is_shaded = True
                shade_reason = "저고도 시계비행(VFR) 전용 고시"

        # 2. Critical Impact Assessment (Red Alert / High Priority)
        level = "INFO"
        
        if is_shaded:
            level = "SHADED"
        elif category == "RUNWAY" and any(k in upper for k in ["CLSD", "CLOSED", "NOT AVBL", "UNAVBL", "OUT OF SERVICE"]):
            level = "CRITICAL"
        elif category == "NAVAID" and any(k in upper for k in ["ILS", "LOC", "GP", "GLIDE PATH"]) and any(k in upper for k in ["U/S", "OTS", "OUT OF SERVICE", "CAT II", "CAT III"]):
            level = "CRITICAL"
        elif any(k in upper for k in ["AD CLSD", "AIRPORT CLOSED", "AERODROME CLOSED", "PROHIBITED", "EMERGENCY"]):
            level = "CRITICAL"
        elif any(k in upper for k in ["SEVERE TURB", "VOLCANIC ASH", "SEVERE ICING"]):
            level = "CRITICAL"
            
        # 3. Caution Impact Assessment (Yellow Alert / Medium Priority)
        elif category == "TAXIWAY" and any(k in upper for k in ["CLSD", "CLOSED", "WIP", "LIMIT"]):
            level = "CAUTION"
        elif category == "LIGHTING" and any(k in upper for k in ["U/S", "OTS", "OUT OF SERVICE", "UNSERVICEABLE"]):
            level = "CAUTION"
        elif category == "NAVAID" and any(k in upper for k in ["VOR", "DME", "NDB", "PAPI"]) and any(k in upper for k in ["U/S", "OTS"]):
            level = "CAUTION"
        elif category == "PROCEDURE" and any(k in upper for k in ["NOT AUTH", "CANCELLED", "CHG", "RESTRICTED", "SPEED"]):
            level = "CAUTION"
        elif category == "RAMP" and any(k in upper for k in ["CLSD", "CLOSED", "WIP", "RESTRICTED"]):
            level = "CAUTION"
        elif category == "HAZARD" and any(k in upper for k in ["BIRD", "WILDLIFE", "WIP"]):
            level = "CAUTION"

        return level, is_shaded, shade_reason
