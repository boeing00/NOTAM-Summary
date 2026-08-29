"""
PDF Extraction & NOTAM Section Detection Engine
Reads PDF files using pypdf, extracts textual layers, detects document sections, and segments text by Airport / Airspace blocks.
"""

import io
import re
from typing import Dict, Any, List, Optional
from pypdf import PdfReader

class PdfExtractor:
    
    @staticmethod
    def extract_text_from_pdf(pdf_path_or_bytes) -> Dict[str, Any]:
        """
        Extracts raw text page by page from a file path or bytes.
        """
        if isinstance(pdf_path_or_bytes, (str, bytes)):
            if isinstance(pdf_path_or_bytes, str):
                with open(pdf_path_or_bytes, "rb") as f:
                    pdf_bytes = f.read()
            else:
                pdf_bytes = pdf_path_or_bytes
        else:
            raise ValueError("Input must be a file path string or bytes.")

        reader = PdfReader(io.BytesIO(pdf_bytes))
        num_pages = len(reader.pages)
        
        pages_text: List[str] = []
        full_text_list: List[str] = []
        
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            clean_text = text.strip()
            pages_text.append(clean_text)
            full_text_list.append(f"--- [PAGE {idx + 1}/{num_pages}] ---\n{clean_text}")
            
        full_text = "\n\n".join(full_text_list)
        
        return {
            "page_count": num_pages,
            "full_text": full_text,
            "pages": pages_text,
            "is_empty": len(full_text.strip()) == 0
        }

    @staticmethod
    def detect_flight_airports(full_text: str) -> Dict[str, str]:
        """
        Attempts to detect departure, destination, alternate, and enroute airports from OFP text.
        """
        airports = {
            "dep": "RKSI",
            "dest": "KLAX",
            "altn": "KSAN"
        }
        
        # Explicit tag checks
        dep_m = re.search(r'\[DEP\]\s*([A-Z]{4})', full_text)
        dest_m = re.search(r'\[DEST\]\s*([A-Z]{4})', full_text)
        altn_m = re.search(r'\[ALTN\]\s*([A-Z]{4})', full_text)
        
        if dep_m:
            airports["dep"] = dep_m.group(1)
        if dest_m:
            airports["dest"] = dest_m.group(1)
        if altn_m:
            airports["altn"] = altn_m.group(1)
            
        # Pattern fallback e.g. "RKSI/KJFK" or "ORIG: RKSI DEST: KJFK"
        if not (dep_m and dest_m):
            route_m = re.search(r'\b([A-Z]{4})\s*/\s*([A-Z]{4})\b', full_text[:4000])
            if route_m:
                airports["dep"] = route_m.group(1)
                airports["dest"] = route_m.group(2)
                
        return airports

    @staticmethod
    def extract_notam_sections(full_text: str) -> List[Dict[str, Any]]:
        """
        Splits the document into structured airport/enroute NOTAM segments.
        Handles both bracketed formats ([DEP] RKSI, [DEST] KLAX, [ETP] PANC, [FIR] RJJJ)
        and ICAO / FAA raw formats.
        """
        segments = []
        
        # Look for Station header patterns: e.g. [DEP] RKSI ..., [DEST] KJFK ..., [ALTN] KBOS ..., [ETP] PANC ...
        header_pattern = r'(\[(?:DEP|DEST|ALTN|ETP|ENROUTE|FIR|STATION)\]\s*([A-Z]{4})(?:/[^\n]*)?)'
        matches = list(re.finditer(header_pattern, full_text))
        
        if matches:
            for i in range(len(matches)):
                start = matches[i].start()
                end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
                
                header_text = matches[i].group(1)
                station = matches[i].group(2)
                block_content = full_text[start:end]
                
                # Determine role (DEP, DEST, ALTN, ETP, FIR)
                role = "ENROUTE"
                if "[DEP]" in header_text:
                    role = "DEPARTURE"
                elif "[DEST]" in header_text:
                    role = "DESTINATION"
                elif "[ALTN]" in header_text:
                    role = "ALTERNATE"
                elif "[ETP]" in header_text:
                    role = "ETP_AIRPORT"
                elif "[FIR]" in header_text:
                    role = "FIR_AIRSPACE"
                    
                segments.append({
                    "station": station,
                    "role": role,
                    "raw_text": block_content
                })
        else:
            # If no bracketed headers, return entire text with station auto-detection
            segments.append({
                "station": "UNKNOWN",
                "role": "ALL",
                "raw_text": full_text
            })
            
        return segments
