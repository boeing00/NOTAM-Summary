#!/usr/bin/env python3
"""
NOTAM Deep Analyzer & Route Compliance CLI
Usage:
    python analyze_notam.py <pdf_path> [options]

Examples:
    python analyze_notam.py flight_plan.pdf
    python analyze_notam.py flight_plan.pdf --format html --open
    python analyze_notam.py flight_plan.pdf --output ./reports --format all
"""

import os
import sys
import argparse
import webbrowser
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from notam_analyzer.extractor import PdfExtractor
from notam_analyzer.parser import NotamParser
from notam_analyzer.route_compliance import RouteComplianceValidator
from notam_analyzer.reporters.html_reporter import HtmlReporter
from notam_analyzer.reporters.markdown_reporter import MarkdownReporter, JsonReporter, CsvReporter

# ANSI Color codes for clean terminal output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
RESET = "\033[0m"

def main():
    parser = argparse.ArgumentParser(
        description="✈️ NOTAM Deep Analyzer & Route Compliance: Extract NOTAMs and validate Flight Plan compliance."
    )
    parser.add_argument("pdf_path", type=str, help="Path to the PDF file (Flight Plan, OFP, NOTAM package)")
    parser.add_argument("-o", "--output", type=str, default="./output", help="Output directory (default: ./output)")
    parser.add_argument("-f", "--format", type=str, choices=["all", "html", "md", "json", "csv"], default="all", help="Output format (default: all)")
    parser.add_argument("--open", action="store_true", help="Automatically open generated HTML report in web browser")
    parser.add_argument("--hide-shaded", action="store_true", help="Exclude shaded (low-priority) NOTAMs from text reports")
    
    args = parser.parse_args()

    pdf_file = Path(args.pdf_path)
    if not pdf_file.exists():
        print(f"{RED}[Error] File not found: {pdf_file}{RESET}")
        sys.exit(1)

    print(f"\n{BOLD}{CYAN}✈️  NOTAM Deep Analyzer & Route Compliance Engine starting...{RESET}")
    print(f"{BLUE}📄 Processing PDF:{RESET} {pdf_file.name}")

    # 1. Extract PDF Text
    try:
        doc_data = PdfExtractor.extract_text_from_pdf(str(pdf_file))
    except Exception as e:
        print(f"{RED}[Error] Failed to read PDF: {e}{RESET}")
        sys.exit(1)

    page_count = doc_data["page_count"]
    full_text = doc_data["full_text"]
    print(f"   ✓ Extracted {page_count} pages.")

    # 2. Detect Route & Airports
    airports = PdfExtractor.detect_flight_airports(full_text)
    dep = airports.get("dep", "DEP")
    dest = airports.get("dest", "DEST")
    print(f"   ✓ Route Identified: {BOLD}{dep} ➔ {dest}{RESET}")

    # 3. Detect NOTAM Sections & Parse Items
    sections = PdfExtractor.extract_notam_sections(full_text)
    station_map = {s["station"]: s["role"] for s in sections}

    notam_items = NotamParser.parse_text(full_text, station_role_map=station_map)
    total_count = len(notam_items)
    
    # 4. Validate Route & Flight Plan Compliance
    compliance_results = RouteComplianceValidator.validate_compliance(full_text, notam_items, airports)

    # Statistics
    crit = [x for x in notam_items if x.level == "CRITICAL"]
    caut = [x for x in notam_items if x.level == "CAUTION"]
    info = [x for x in notam_items if x.level == "INFO"]
    shaded = [x for x in notam_items if x.is_shaded or x.level == "SHADED"]

    comp_ok = sum(1 for c in compliance_results if c.status == "COMPLIANT")
    comp_warn = sum(1 for c in compliance_results if c.status == "WARNING")
    comp_non = sum(1 for c in compliance_results if c.status == "NON_COMPLIANT")

    print(f"\n{BOLD}📊 NOTAM 분석 결과 요약:{RESET}")
    print(f"   • 전체 NOTAM 수: {BOLD}{total_count}건{RESET}")
    print(f"   • 🔴 {RED}CRITICAL (운항직결): {len(crit)}건{RESET}")
    print(f"   • 🟡 {YELLOW}CAUTION (운항주의): {len(caut)}건{RESET}")
    print(f"   • ⚪ {BLUE}INFO (일반참고): {len(info)}건{RESET}")
    print(f"   • ⚪ 음영/필터링: {len(shaded)}건")

    # Display Route Compliance Section in Terminal
    if compliance_results:
        print(f"\n{BOLD}{MAGENTA}🧭 [항로상 비행계획 NOTAM 준수성 자동 검증 (Route Compliance)]{RESET}")
        print(f"   • 검증 현황: {GREEN}✅ 준수 {comp_ok}건{RESET} | {YELLOW}⚠️ 주의/모니터링 {comp_warn}건{RESET} | {RED}🚨 위반 {comp_non}건{RESET}")
        for c in compliance_results:
            status_tag = f"{GREEN}✅ [COMPLIANT]{RESET}" if c.status == "COMPLIANT" else (f"{YELLOW}⚠️ [WARNING]{RESET}" if c.status == "WARNING" else f"{RED}🚨 [NON-COMPLIANT]{RESET}")
            print(f"   {status_tag} {BOLD}{c.title}{RESET} ({CYAN}{c.notam_ref}{RESET})")
            print(f"     ↳ 근거: {c.filed_evidence}")
            print(f"     ↳ 설명: {c.details_ko}")

    # Terminal Critical Highlights
    if crit:
        print(f"\n{BOLD}{RED}🚨 [CRITICAL HIGHLIGHTS - 필수 확인 사항]{RESET}")
        for c in crit:
            print(f"   {RED}▶ [{c.station}] {c.id} ({c.category}):{RESET} {c.summary_ko}")
            if c.action_tip_ko:
                print(f"     💡 {YELLOW}{c.action_tip_ko}{RESET}")

    # 5. Generate Reports
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    base_name = pdf_file.stem

    # HTML Report
    if args.format in ["all", "html"]:
        html_content = HtmlReporter.generate_html(notam_items, airports, doc_filename=pdf_file.name, compliance_results=compliance_results)
        html_path = out_dir / f"{base_name}_NOTAM_REPORT.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"\n{GREEN}✓ HTML Dashboard saved:{RESET} {html_path}")

    # Markdown Report
    if args.format in ["all", "md"]:
        md_content = MarkdownReporter.generate_markdown(notam_items, airports, doc_filename=pdf_file.name, compliance_results=compliance_results)
        md_path = out_dir / f"{base_name}_NOTAM_REPORT.md"
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        print(f"{GREEN}✓ Markdown Report saved:{RESET} {md_path}")

    # JSON Export
    if args.format in ["all", "json"]:
        json_content = JsonReporter.generate_json(notam_items, airports, doc_filename=pdf_file.name, compliance_results=compliance_results)
        json_path = out_dir / f"{base_name}_NOTAM_REPORT.json"
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(json_content)
        print(f"{GREEN}✓ JSON Data saved:{RESET} {json_path}")

    # CSV Export
    if args.format in ["all", "csv"]:
        csv_content = CsvReporter.generate_csv(notam_items)
        csv_path = out_dir / f"{base_name}_NOTAM_REPORT.csv"
        with open(csv_path, "w", encoding="utf-8-sig") as f:
            f.write(csv_content)
        print(f"{GREEN}✓ CSV Spreadsheet saved:{RESET} {csv_path}")

    # Open Browser if requested
    if args.open and (args.format in ["all", "html"]):
        html_file = out_dir / f"{base_name}_NOTAM_REPORT.html"
        print(f"\n🌐 Opening HTML report in your browser...")
        webbrowser.open(html_file.as_uri())

    print(f"\n{BOLD}{GREEN}✨ NOTAM 분석 및 항로 준수성 검증이 성공적으로 완료되었습니다!{RESET}\n")

if __name__ == "__main__":
    main()
