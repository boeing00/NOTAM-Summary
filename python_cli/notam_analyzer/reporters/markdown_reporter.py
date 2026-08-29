"""
Markdown, JSON, and CSV Reporters for NOTAM & Route Compliance Analysis
"""

import csv
import json
import io
from typing import List, Dict, Any, Optional
from notam_analyzer.parser import NotamItem
from notam_analyzer.route_compliance import ComplianceCheckResult

class MarkdownReporter:
    
    @staticmethod
    def generate_markdown(
        items: List[NotamItem],
        flight_meta: Dict[str, Any],
        doc_filename: str = "flight_document.pdf",
        compliance_results: Optional[List[ComplianceCheckResult]] = None
    ) -> str:
        if compliance_results is None:
            compliance_results = []

        lines = []
        dep = flight_meta.get("dep", "DEP")
        dest = flight_meta.get("dest", "DEST")
        
        lines.append(f"# ✈️ NOTAM & 비행계획 항로 준수성 분석 리포트 ({dep} ➔ {dest})")
        lines.append(f"- **문서 파일명**: `{doc_filename}`")
        lines.append(f"- **총 분석 NOTAM 수**: {len(items)}건")
        
        # Summary counts
        crit = [x for x in items if x.level == "CRITICAL"]
        caut = [x for x in items if x.level == "CAUTION"]
        info = [x for x in items if x.level == "INFO"]
        shaded = [x for x in items if x.is_shaded or x.level == "SHADED"]
        
        comp_ok = sum(1 for c in compliance_results if c.status == "COMPLIANT")
        comp_warn = sum(1 for c in compliance_results if c.status == "WARNING")
        comp_non = sum(1 for c in compliance_results if c.status == "NON_COMPLIANT")
        
        lines.append(f"- **위험도 현황**: 🔴 CRITICAL {len(crit)}건 | 🟡 CAUTION {len(caut)}건 | ⚪ INFO {len(info)}건 | ⚪ SHADED {len(shaded)}건")
        lines.append(f"- **항로 규정 준수 검증**: ✅ 준수 {comp_ok}건 | ⚠️ 주의/모니터링 {comp_warn}건 | 🚨 위반 {comp_non}건\n")
        
        # 1. Route Compliance Section
        if compliance_results:
            lines.append("## 🧭 1. 항로상 비행계획 NOTAM 준수성 자동 검증 (Flight Plan Compliance)")
            lines.append("| 검증 항목 | 근거 NOTAM/규정 | 준수 여부 | 비행계획(FPL) 반영 근거 & 상세 분석 |")
            lines.append("|---|---|:---:|---|")
            for c in compliance_results:
                badge = "✅ COMPLIANT" if c.status == "COMPLIANT" else ("⚠️ WARNING" if c.status == "WARNING" else "🚨 NON_COMPLIANT")
                lines.append(f"| **{c.title}** | `{c.notam_ref}` | **{badge}** | **근거:** `{c.filed_evidence}`<br>*{c.details_ko}* |")
            lines.append("")

        # 2. Critical Table
        lines.append("## 🔴 2. 운항 직결 핵심 NOTAM (CRITICAL)")
        if crit:
            lines.append("| 공항 | ID / 구분 | 분류 | 한국어 요약 & 조종사 조치사항 | 유효기간 |")
            lines.append("|---|---|---|---|---|")
            for item in crit:
                lines.append(f"| **{item.station}** | `{item.id}` | {item.category} | **{item.summary_ko}**<br>💡 *{item.action_tip_ko}* | `{item.valid_period}` |")
        else:
            lines.append("> ✅ 특이 활주로/공항 폐쇄 등 긴급 고시 사항 없음.")
        lines.append("")

        # 3. Caution Table
        lines.append("## 🟡 3. 운항 주의 NOTAM (CAUTION)")
        if caut:
            lines.append("| 공항 | ID / 구분 | 분류 | 한국어 요약 & 조종사 조치사항 | 유효기간 |")
            lines.append("|---|---|---|---|---|")
            for item in caut:
                lines.append(f"| **{item.station}** | `{item.id}` | {item.category} | {item.summary_ko}<br>*{item.action_tip_ko}* | `{item.valid_period}` |")
        else:
            lines.append("> ✅ 유도로/등화/항법시설 결함 관련 주의 사항 없음.")
        lines.append("")

        # 4. Airport Breakdown
        stations = sorted(list(set(x.station for x in items)))
        lines.append("## 📋 4. 공항별 전체 NOTAM 목록")
        for stn in stations:
            stn_items = [x for x in items if x.station == stn]
            lines.append(f"### 📍 {stn} ({len(stn_items)}건)")
            for item in stn_items:
                shade_tag = f" `[음영: {item.shade_reason}]`" if item.is_shaded else ""
                lines.append(f"- **[{item.level}]** `{item.id}` ({item.category}){shade_tag}: {item.summary_ko}")
                if item.action_tip_ko:
                    lines.append(f"  - 💡 *조치사항: {item.action_tip_ko}*")
            lines.append("")

        return "\n".join(lines)

class JsonReporter:
    
    @staticmethod
    def generate_json(
        items: List[NotamItem],
        flight_meta: Dict[str, Any],
        doc_filename: str = "flight_document.pdf",
        compliance_results: Optional[List[ComplianceCheckResult]] = None
    ) -> str:
        if compliance_results is None:
            compliance_results = []
            
        data = {
            "metadata": {
                "filename": doc_filename,
                "route": f"{flight_meta.get('dep', 'DEP')} -> {flight_meta.get('dest', 'DEST')}",
                "total_notams": len(items),
                "summary": {
                    "critical": sum(1 for x in items if x.level == "CRITICAL"),
                    "caution": sum(1 for x in items if x.level == "CAUTION"),
                    "info": sum(1 for x in items if x.level == "INFO"),
                    "shaded": sum(1 for x in items if x.is_shaded or x.level == "SHADED")
                },
                "compliance_summary": {
                    "compliant": sum(1 for c in compliance_results if c.status == "COMPLIANT"),
                    "warning": sum(1 for c in compliance_results if c.status == "WARNING"),
                    "non_compliant": sum(1 for c in compliance_results if c.status == "NON_COMPLIANT")
                }
            },
            "route_compliance_verification": [c.to_dict() for c in compliance_results],
            "notams": [item.to_dict() for item in items]
        }
        return json.dumps(data, ensure_ascii=False, indent=2)

class CsvReporter:
    
    @staticmethod
    def generate_csv(items: List[NotamItem]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "Index",
            "NOTAM_ID",
            "Station",
            "Airport_Name",
            "Level",
            "Category",
            "Is_Shaded",
            "Shade_Reason",
            "Valid_Period",
            "Summary_KO",
            "Action_Tip_KO",
            "Raw_Text"
        ])
        
        for item in items:
            writer.writerow([
                item.index,
                item.id,
                item.station,
                item.airport_name,
                item.level,
                item.category,
                "YES" if item.is_shaded else "NO",
                item.shade_reason,
                item.valid_period,
                item.summary_ko,
                item.action_tip_ko,
                item.raw_text.replace("\n", " ")
            ])
            
        return output.getvalue()
