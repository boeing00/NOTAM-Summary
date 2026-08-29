"""
Optional AI Enhancement for NOTAM Analysis using Google Gemini
Provides deep threat analysis (TEM) and audio-ready pilot briefing if GEMINI_API_KEY is available.
"""

import os
import json
from typing import List, Dict, Any, Optional
from notam_analyzer.parser import NotamItem

class GeminiEnhancer:
    
    @staticmethod
    def enhance_notams_with_gemini(
        items: List[NotamItem],
        flight_meta: Dict[str, Any],
        api_key: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Uses Gemini API to synthesize critical NOTAM threats and generate an executive cockpit briefing.
        """
        key = api_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            return None
            
        try:
            from google import genai
            from google.genai import types
            
            client = genai.Client(api_key=key)
            
            # Prepare compact NOTAM summary for prompt
            crit_and_caut = [x for x in items if x.level in ["CRITICAL", "CAUTION"]]
            notam_snippets = "\n".join([
                f"- [{x.station}] {x.id} ({x.category} / {x.level}): {x.summary_ko} | Tip: {x.action_tip_ko}"
                for x in crit_and_caut[:30]
            ])
            
            prompt = f"""
당신은 베테랑 민항기 기장 및 항공 안전 전문가입니다.
다음은 이번 비행({flight_meta.get('dep', 'RKSI')} -> {flight_meta.get('dest', 'KLAX')})에서 추출된 핵심 NOTAM 목록입니다.

[NOTAM 목록]
{notam_snippets}

위 NOTAM들을 종합적으로 검토하여 다음 JSON 형식으로 전문 조종사 브리핑을 작성해 주세요:
{{
  "executive_summary": "기장/부기장을 위한 3~4문장의 핵심 요약 브리핑",
  "tem_threats": [
    {{
      "threat": "위협 요소 (예: KLAX 24R 유도로 공사로 인한 지상 정체 및 활주로 오진입 위험)",
      "mitigation": "경감 조치 (예: 지상 활주 차트 숙지, Hotspot 통과 시 양 조종사 복창 확인)"
    }}
  ],
  "audio_script": "안녕하십니까 기장님, 금일 비행 관련 주요 노탐 브리핑입니다..."
}}
JSON 문자열만 반환하세요.
"""
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )
            
            if response and response.text:
                return json.loads(response.text)
        except Exception as e:
            print(f"[Warning] Gemini enhancement skipped: {e}")
            return None

        return None
