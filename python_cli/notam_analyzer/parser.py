"""
NOTAM Block Parser & Normalizer
Parses raw text blocks into strongly-typed NOTAM data records with airport info, validity periods, categories, decoded text, and action items.
"""

import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict

from notam_analyzer.decoder import decode_icao_text, generate_korean_summary, get_airport_name, AIRPORT_DB
from notam_analyzer.classifier import NotamClassifier

@dataclass
class NotamItem:
    index: int
    id: str
    station: str
    airport_name: str
    role: str
    category: str
    level: str  # CRITICAL, CAUTION, INFO, SHADED
    is_shaded: bool
    shade_reason: str
    valid_period: str
    raw_text: str
    decoded_text: str
    summary_ko: str
    action_tip_ko: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class NotamParser:
    
    @classmethod
    def parse_text(cls, pdf_text: str, station_role_map: Optional[Dict[str, str]] = None) -> List[NotamItem]:
        """
        Parses all NOTAMs from the given text string.
        """
        if station_role_map is None:
            station_role_map = {}
            
        items: List[NotamItem] = []
        seen_ids = set()
        idx = 1
        
        # Regex Pattern 1: Date Range + Station + NOTAM ID format
        # e.g., "09JUL26 12:05 - 30SEP27 12:05 PANC A4415/26\nE) RWY 15 PAPI U/S..."
        # or "1. 01MAY20 00:00 - UFN KORD COAD01/20\nE) ..."
        p1 = r'(?:(?:\d+\.\s*)?(\d{2}[A-Z]{3}\d{2}\s+\d{2}:\d{2})\s*-\s*([^\n\r]+?)\s+([A-Z]{4})\s+([A-Z0-9/]+))(?:\r?\n)([\s\S]*?)(?=(?:\r?\n(?:\d+\.\s*)?\d{2}[A-Z]{3}\d{2}\s+\d{2}:\d{2}\s*-|\r?\n\[[A-Z]+\]|\r?\n◼|\Z))'
        
        for m in re.finditer(p1, pdf_text):
            valid_start = m.group(1).strip()
            valid_end = m.group(2).strip()
            station = m.group(3).strip()
            notam_num = m.group(4).strip()
            body = m.group(5).strip()
            
            notam_id = f"{station} {notam_num}"
            if notam_id in seen_ids:
                continue
            seen_ids.add(notam_id)
            
            raw_full = f"{valid_start} - {valid_end} {station} {notam_num}\n{body}"
            
            item = cls._build_item(
                index=idx,
                notam_id=notam_id,
                station=station,
                valid_period=f"{valid_start} ~ {valid_end}",
                raw_text=raw_full,
                station_role_map=station_role_map
            )
            items.append(item)
            idx += 1

        # Regex Pattern 2: Standard ICAO NOTAM Format
        # e.g., "A1234/26 NOTAMN\nQ) RJJJ/...\nA) RJAA B) 2608100000 C) 2608312359\nE) RWY 16R/34L CLSD"
        p2 = r'\b([A-Z]\d{4}/\d{2}|[A-Z]{1,2}\d{4}/\d{2})\s+NOTAM[NRC]\b([\s\S]*?)(?=\b[A-Z]\d{4}/\d{2}\s+NOTAM|\Z)'
        for m in re.finditer(p2, pdf_text):
            notam_num = m.group(1).strip()
            body_block = m.group(0).strip()
            
            # Extract Station
            stn_m = re.search(r'\bA\)\s*([A-Z]{4})\b', body_block)
            station = stn_m.group(1) if stn_m else "UNKNOWN"
            
            # Extract Valid Period
            b_m = re.search(r'\bB\)\s*(\d{10})\b', body_block)
            c_m = re.search(r'\bC\)\s*(\d{10}|PERM|UFN)\b', body_block)
            v_start = b_m.group(1) if b_m else ""
            v_end = c_m.group(1) if c_m else ""
            valid_period = f"{v_start} ~ {v_end}" if (v_start or v_end) else "CURRENT"
            
            notam_id = f"{station} {notam_num}"
            if notam_id in seen_ids:
                continue
            seen_ids.add(notam_id)
            
            item = cls._build_item(
                index=idx,
                notam_id=notam_id,
                station=station,
                valid_period=valid_period,
                raw_text=body_block,
                station_role_map=station_role_map
            )
            items.append(item)
            idx += 1
            
        # Regex Pattern 3: Fallback generic Station + Number block
        if len(items) == 0:
            p3 = r'\b([A-Z]{4})\s+([A-Z]\d{4}/\d{2}|COAD\d{2}/\d{2})\b([^\n\r]*\n(?:[^\n\r]*\n){1,8})'
            for m in re.finditer(p3, pdf_text):
                station = m.group(1)
                notam_num = m.group(2)
                raw_block = m.group(0).strip()
                notam_id = f"{station} {notam_num}"
                if notam_id in seen_ids:
                    continue
                seen_ids.add(notam_id)
                
                item = cls._build_item(
                    index=idx,
                    notam_id=notam_id,
                    station=station,
                    valid_period="ACTIVE",
                    raw_text=raw_block,
                    station_role_map=station_role_map
                )
                items.append(item)
                idx += 1
                
        return items

    @classmethod
    def _build_item(
        cls,
        index: int,
        notam_id: str,
        station: str,
        valid_period: str,
        raw_text: str,
        station_role_map: Dict[str, str]
    ) -> NotamItem:
        # Category
        category = NotamClassifier.classify_category(raw_text)
        
        # Impact & Shading
        level, is_shaded, shade_reason = NotamClassifier.evaluate_impact_and_shading(raw_text, category)
        
        # Airport Name & Role
        airport_name = get_airport_name(station)
        role = station_role_map.get(station, "ENROUTE")
        
        # Decoded Text & Korean Summary / Actions
        decoded_text = decode_icao_text(raw_text)
        summary_ko, action_tip_ko = generate_korean_summary(station, category, raw_text)
        
        return NotamItem(
            index=index,
            id=notam_id,
            station=station,
            airport_name=airport_name,
            role=role,
            category=category,
            level=level,
            is_shaded=is_shaded,
            shade_reason=shade_reason,
            valid_period=valid_period,
            raw_text=raw_text,
            decoded_text=decoded_text,
            summary_ko=summary_ko,
            action_tip_ko=action_tip_ko
        )
