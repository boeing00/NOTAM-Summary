"""
Interactive Pilot NOTAM Dashboard HTML Generator
Generates a standalone, beautiful, responsive, dark-mode HTML briefing report with automated Route Compliance Verification.
"""

import json
from typing import List, Dict, Any
from notam_analyzer.parser import NotamItem
from notam_analyzer.route_compliance import ComplianceCheckResult

class HtmlReporter:
    
    @staticmethod
    def generate_html(
        items: List[NotamItem],
        flight_meta: Dict[str, Any],
        doc_filename: str = "flight_document.pdf",
        compliance_results: List[ComplianceCheckResult] = None
    ) -> str:
        
        if compliance_results is None:
            compliance_results = []
            
        items_dict = [item.to_dict() for item in items]
        items_json = json.dumps(items_dict, ensure_ascii=False)
        
        comp_dict = [comp.to_dict() for comp in compliance_results]
        comp_json = json.dumps(comp_dict, ensure_ascii=False)
        
        # Statistics
        total_count = len(items)
        critical_count = sum(1 for x in items if x.level == "CRITICAL")
        caution_count = sum(1 for x in items if x.level == "CAUTION")
        info_count = sum(1 for x in items if x.level == "INFO")
        shaded_count = sum(1 for x in items if x.is_shaded or x.level == "SHADED")
        
        # Unique Stations
        stations = sorted(list(set(x.station for x in items)))
        
        # Compliance stats
        comp_ok = sum(1 for c in compliance_results if c.status == "COMPLIANT")
        comp_warn = sum(1 for c in compliance_results if c.status == "WARNING")
        comp_non = sum(1 for c in compliance_results if c.status == "NON_COMPLIANT")
        
        html = f"""<!DOCTYPE html>
<html lang="ko" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NOTAM Deep Analysis & Route Compliance | {flight_meta.get('dep', 'DEP')} -> {flight_meta.get('dest', 'DEST')}</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        tailwind.config = {{
            darkMode: 'class',
            theme: {{
                extend: {{
                    colors: {{
                        slate: {{
                            850: '#151f32',
                            950: '#0a0f1d',
                        }}
                    }}
                }}
            }}
        }}
    </script>
    <style>
        ::-webkit-scrollbar {{ width: 6px; height: 6px; }}
        ::-webkit-scrollbar-track {{ background: #0f172a; }}
        ::-webkit-scrollbar-thumb {{ background: #334155; border-radius: 3px; }}
        ::-webkit-scrollbar-thumb:hover {{ background: #475569; }}
        .badge-critical {{ background: rgba(225, 29, 72, 0.15); color: #fda4af; border: 1px solid rgba(225, 29, 72, 0.3); }}
        .badge-caution {{ background: rgba(245, 158, 11, 0.15); color: #fde68a; border: 1px solid rgba(245, 158, 11, 0.3); }}
        .badge-info {{ background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3); }}
        .badge-shaded {{ background: rgba(100, 116, 139, 0.15); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.3); }}
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200">

    <!-- Top Navigation Header -->
    <header class="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
                    <i data-lucide="plane-takeoff" class="w-5 h-5"></i>
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h1 class="text-base font-bold text-white tracking-wide">NOTAM & Route Compliance Analyzer</h1>
                        <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">v2.0 Pro</span>
                    </div>
                    <p class="text-xs text-slate-400 font-mono">File: {doc_filename} | Route: {flight_meta.get('dep', 'DEP')} ➔ {flight_meta.get('dest', 'DEST')}</p>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2">
                <button onclick="window.print()" class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition">
                    <i data-lucide="printer" class="w-4 h-4 text-slate-400"></i>
                    <span>인쇄 / PDF 저장</span>
                </button>
            </div>
        </div>
    </header>

    <!-- Main Container -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        <!-- 1. Enroute Flight Plan NOTAM Compliance Section -->
        <div class="bg-slate-900 border border-emerald-900/50 rounded-xl p-5 shadow-lg space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div class="flex items-center gap-2.5">
                    <div class="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
                        <i data-lucide="shield-check" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                            항로상 비행계획 NOTAM 준수성 자동 검증 (Flight Plan Compliance)
                        </h2>
                        <p class="text-xs text-slate-400">UPR 항로 규칙, YUKON 군공역, CDR 유효시간, 화산재 안전고도, PBN 인증 대조 결과</p>
                    </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                    <span class="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                        ✅ 준수 {comp_ok}건
                    </span>
                    {f'<span class="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">⚠️ 주의 {comp_warn}건</span>' if comp_warn else ''}
                    {f'<span class="px-2.5 py-1 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold">🚨 위반 {comp_non}건</span>' if comp_non else ''}
                </div>
            </div>

            <!-- Compliance Table / Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="complianceGrid">
                {"".join([f'''
                <div class="bg-slate-950 border {'border-emerald-900/40' if c.status == 'COMPLIANT' else ('border-amber-900/50' if c.status == 'WARNING' else 'border-rose-900/60')} rounded-lg p-4 space-y-2">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-bold font-mono {'text-emerald-400' if c.status == 'COMPLIANT' else ('text-amber-400' if c.status == 'WARNING' else 'text-rose-400')}">
                            {'✅ COMPLIANT' if c.status == 'COMPLIANT' else ('⚠️ OPERATIONAL WARNING' if c.status == 'WARNING' else '🚨 NON-COMPLIANT')}
                        </span>
                        <span class="text-[11px] font-mono text-slate-500">[{c.notam_ref}]</span>
                    </div>
                    <h3 class="text-sm font-bold text-slate-100">{c.title}</h3>
                    <p class="text-xs text-slate-400 leading-relaxed"><span class="text-slate-500 font-semibold">규정 내용:</span> {c.rule_description}</p>
                    <div class="bg-slate-900/80 border border-slate-800 rounded p-2 text-xs font-mono text-amber-300/90">
                        <span class="text-slate-400">제출 FPL 근거:</span> {c.filed_evidence}
                    </div>
                    <p class="text-xs text-slate-300 pt-1">{c.details_ko}</p>
                </div>
                ''' for c in compliance_results])}
            </div>
        </div>

        <!-- 2. KPI Metrics Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <span class="text-xs text-slate-400 font-medium flex items-center justify-between">
                    전체 NOTAM
                    <i data-lucide="file-text" class="w-4 h-4 text-slate-500"></i>
                </span>
                <span class="text-2xl font-bold font-mono text-white mt-2">{total_count}</span>
            </div>
            <div onclick="filterByLevel('CRITICAL')" class="bg-slate-900 border border-rose-900/50 hover:border-rose-700 rounded-xl p-4 flex flex-col justify-between cursor-pointer transition">
                <span class="text-xs text-rose-400 font-medium flex items-center justify-between">
                    🔴 CRITICAL (운항직결)
                    <i data-lucide="alert-octagon" class="w-4 h-4 text-rose-400"></i>
                </span>
                <span class="text-2xl font-bold font-mono text-rose-400 mt-2">{critical_count}</span>
            </div>
            <div onclick="filterByLevel('CAUTION')" class="bg-slate-900 border border-amber-900/50 hover:border-amber-700 rounded-xl p-4 flex flex-col justify-between cursor-pointer transition">
                <span class="text-xs text-amber-400 font-medium flex items-center justify-between">
                    🟡 CAUTION (운항주의)
                    <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400"></i>
                </span>
                <span class="text-2xl font-bold font-mono text-amber-400 mt-2">{caution_count}</span>
            </div>
            <div onclick="filterByLevel('INFO')" class="bg-slate-900 border border-blue-900/50 hover:border-blue-700 rounded-xl p-4 flex flex-col justify-between cursor-pointer transition">
                <span class="text-xs text-blue-400 font-medium flex items-center justify-between">
                    ⚪ INFO (일반참고)
                    <i data-lucide="info" class="w-4 h-4 text-blue-400"></i>
                </span>
                <span class="text-2xl font-bold font-mono text-blue-400 mt-2">{info_count}</span>
            </div>
            <div onclick="filterByLevel('SHADED')" class="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between cursor-pointer transition">
                <span class="text-xs text-slate-400 font-medium flex items-center justify-between">
                    ⚪ SHADED (음영/제외)
                    <i data-lucide="eye-off" class="w-4 h-4 text-slate-500"></i>
                </span>
                <span class="text-2xl font-bold font-mono text-slate-400 mt-2">{shaded_count}</span>
            </div>
        </div>

        <!-- 3. Filter & Search Controls -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div class="flex flex-col md:flex-row gap-3 items-center justify-between">
                
                <!-- Search Input -->
                <div class="relative w-full md:w-96">
                    <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
                    <input 
                        type="text" 
                        id="searchInput"
                        oninput="applyFilters()" 
                        placeholder="키워드 검색 (예: RWY 04R, L512, UPR, CLSD, PAPI, ILS)..." 
                        class="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                    />
                </div>

                <!-- View Mode Toggles -->
                <div class="flex items-center gap-2 self-end md:self-auto">
                    <button id="toggleShadedBtn" onclick="toggleShadedVisibility()" class="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-xs font-mono text-slate-300 flex items-center gap-1.5 transition">
                        <i data-lucide="filter" class="w-3.5 h-3.5 text-slate-400"></i>
                        <span id="shadedToggleText">음영(Shaded) 항목 숨기기</span>
                    </button>
                    <button onclick="resetFilters()" class="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-xs font-mono text-slate-400 hover:text-slate-200 transition">
                        초기화
                    </button>
                </div>
            </div>

            <!-- Airport Tabs -->
            <div class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/60" id="airportTabs">
                <button onclick="filterByStation('ALL')" class="stn-tab active px-3 py-1 rounded-md text-xs font-mono bg-amber-500/10 border border-amber-500/40 text-amber-300 transition" data-stn="ALL">
                    ALL STATIONS
                </button>
                {"".join([f'''<button onclick="filterByStation('{stn}')" class="stn-tab px-3 py-1 rounded-md text-xs font-mono bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 transition" data-stn="{stn}">{stn}</button>''' for stn in stations])}
            </div>

            <!-- Category Filter Pills -->
            <div class="flex flex-wrap items-center gap-1.5 pt-1" id="categoryPills">
                <button onclick="filterByCategory('ALL')" class="cat-pill active px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-white transition" data-cat="ALL">전체</button>
                <button onclick="filterByCategory('RUNWAY')" class="cat-pill px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition" data-cat="RUNWAY">🛫 활주로 (RUNWAY)</button>
                <button onclick="filterByCategory('TAXIWAY')" class="cat-pill px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition" data-cat="TAXIWAY">🛬 유도로 (TAXIWAY)</button>
                <button onclick="filterByCategory('NAVAID')" class="cat-pill px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition" data-cat="NAVAID">📡 항법/ILS (NAVAID)</button>
                <button onclick="filterByCategory('LIGHTING')" class="cat-pill px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition" data-cat="LIGHTING">💡 등화 (LIGHTING)</button>
                <button onclick="filterByCategory('PROCEDURE')" class="cat-pill px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition" data-cat="PROCEDURE">🧭 절차/접근 (PROCEDURE)</button>
                <button onclick="filterByCategory('OBSTACLE')" class="cat-pill px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition" data-cat="OBSTACLE">🏗️ 장애물 (OBSTACLE)</button>
                <button onclick="filterByCategory('RAMP')" class="cat-pill px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition" data-cat="RAMP">🅿️ 주기장/램프 (RAMP)</button>
                <button onclick="filterByCategory('AIRSPACE')" class="cat-pill px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition" data-cat="AIRSPACE">🌐 공역/FIR (AIRSPACE)</button>
            </div>
        </div>

        <!-- NOTAM Cards List Container -->
        <div id="notamList" class="space-y-3">
            <!-- Dynamically populated by JavaScript -->
        </div>

    </main>

    <!-- Data Injection & Interactive Scripts -->
    <script>
        const NOTAM_DATA = {items_json};
        
        let currentStation = 'ALL';
        let currentCategory = 'ALL';
        let currentLevel = 'ALL';
        let hideShaded = false;

        function renderNotams() {{
            const listContainer = document.getElementById('notamList');
            const searchKeyword = document.getElementById('searchInput').value.toLowerCase().trim();
            
            const filtered = NOTAM_DATA.filter(item => {{
                if (currentStation !== 'ALL' && item.station !== currentStation) return false;
                if (currentCategory !== 'ALL' && item.category !== currentCategory) return false;
                if (currentLevel !== 'ALL' && item.level !== currentLevel) return false;
                if (hideShaded && (item.is_shaded || item.level === 'SHADED')) return false;
                if (searchKeyword) {{
                    const matchText = (item.id + ' ' + item.station + ' ' + item.category + ' ' + item.raw_text + ' ' + item.summary_ko + ' ' + item.action_tip_ko).toLowerCase();
                    if (!matchText.includes(searchKeyword)) return false;
                }}
                return true;
            }});

            if (filtered.length === 0) {{
                listContainer.innerHTML = `
                    <div class="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
                        <i data-lucide="check-circle-2" class="w-10 h-10 mx-auto mb-3 text-slate-600"></i>
                        <p class="text-sm font-medium">선택한 조건에 부합하는 NOTAM이 없습니다.</p>
                        <p class="text-xs text-slate-600 mt-1">필터를 초기화하거나 검색어를 변경해 보세요.</p>
                    </div>
                `;
                lucide.createIcons();
                return;
            }}

            listContainer.innerHTML = filtered.map(item => {{
                let levelBadgeClass = 'badge-info';
                let borderAccent = 'border-slate-800';
                
                if (item.level === 'CRITICAL') {{
                    levelBadgeClass = 'badge-critical';
                    borderAccent = 'border-rose-900/60 bg-gradient-to-r from-rose-950/20 to-transparent';
                }} else if (item.level === 'CAUTION') {{
                    levelBadgeClass = 'badge-caution';
                    borderAccent = 'border-amber-900/50 bg-gradient-to-r from-amber-950/15 to-transparent';
                }} else if (item.is_shaded || item.level === 'SHADED') {{
                    levelBadgeClass = 'badge-shaded';
                    borderAccent = 'border-slate-800/50 opacity-60';
                }}

                return `
                    <div class="bg-slate-900 border ${{borderAccent}} rounded-xl p-5 shadow-md transition hover:border-slate-700">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-mono text-sm font-bold text-amber-400">${{item.id}}</span>
                                <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">${{item.airport_name}}</span>
                                <span class="text-[11px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-mono">${{item.category}}</span>
                                ${{item.is_shaded ? `<span class="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700 font-mono">음영: ${{item.shade_reason}}</span>` : ''}}
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <span class="text-[11px] font-mono text-slate-500">${{item.valid_period}}</span>
                                <span class="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase ${{levelBadgeClass}}">
                                    ${{item.level}}
                                </span>
                            </div>
                        </div>

                        <!-- Korean Summary & Action Tip -->
                        <div class="mt-3.5 space-y-2">
                            <div class="flex items-start gap-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0"></div>
                                <p class="text-sm font-medium text-slate-100">${{item.summary_ko}}</p>
                            </div>
                            ${{item.action_tip_ko ? `
                                <div class="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs text-amber-200/90 flex items-start gap-2.5">
                                    <i data-lucide="shield-alert" class="w-4 h-4 text-amber-400 shrink-0 mt-0.5"></i>
                                    <div>
                                        <span class="font-semibold text-amber-300">조종사 운항 조치사항:</span>
                                        <span class="ml-1">${{item.action_tip_ko}}</span>
                                    </div>
                                </div>
                            ` : ''}}
                        </div>

                        <!-- Raw & Decoded Text Toggle Area -->
                        <div class="mt-4 pt-3 border-t border-slate-800/60">
                            <details class="group">
                                <summary class="cursor-pointer text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center justify-between select-none">
                                    <span class="flex items-center gap-1.5">
                                        <i data-lucide="terminal" class="w-3.5 h-3.5 text-slate-500"></i>
                                        <span>ICAO 전문 원문 및 약어 해독 보기</span>
                                    </span>
                                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-500 transition group-open:rotate-180"></i>
                                </summary>
                                <div class="mt-3 space-y-2 text-xs">
                                    <div class="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                                        <span class="text-[10px] text-slate-500 font-mono block mb-1 uppercase tracking-wider">ICAO Raw Text</span>
                                        <pre class="font-mono text-slate-300 text-xs whitespace-pre-wrap leading-relaxed">${{item.raw_text}}</pre>
                                    </div>
                                    <div class="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                                        <span class="text-[10px] text-sky-400 font-mono block mb-1 uppercase tracking-wider">Decoded Text (약어 해독)</span>
                                        <p class="font-mono text-sky-200/90 text-xs whitespace-pre-wrap leading-relaxed">${{item.decoded_text}}</p>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>
                `;
            }}).join('');

            lucide.createIcons();
        }}

        function filterByStation(stn) {{
            currentStation = stn;
            document.querySelectorAll('.stn-tab').forEach(el => {{
                if (el.dataset.stn === stn) {{
                    el.className = 'stn-tab active px-3 py-1 rounded-md text-xs font-mono bg-amber-500/10 border border-amber-500/40 text-amber-300 transition';
                }} else {{
                    el.className = 'stn-tab px-3 py-1 rounded-md text-xs font-mono bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 transition';
                }}
            }});
            renderNotams();
        }}

        function filterByCategory(cat) {{
            currentCategory = cat;
            document.querySelectorAll('.cat-pill').forEach(el => {{
                if (el.dataset.cat === cat) {{
                    el.className = 'cat-pill active px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-white transition';
                }} else {{
                    el.className = 'cat-pill px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition';
                }}
            }});
            renderNotams();
        }}

        function filterByLevel(lvl) {{
            currentLevel = (currentLevel === lvl) ? 'ALL' : lvl;
            renderNotams();
        }}

        function toggleShadedVisibility() {{
            hideShaded = !hideShaded;
            document.getElementById('shadedToggleText').innerText = hideShaded ? '음영(Shaded) 항목 표시' : '음영(Shaded) 항목 숨기기';
            renderNotams();
        }}

        function applyFilters() {{
            renderNotams();
        }}

        function resetFilters() {{
            currentStation = 'ALL';
            currentCategory = 'ALL';
            currentLevel = 'ALL';
            hideShaded = false;
            document.getElementById('searchInput').value = '';
            document.getElementById('shadedToggleText').innerText = '음영(Shaded) 항목 숨기기';
            filterByStation('ALL');
            filterByCategory('ALL');
        }}

        renderNotams();
    </script>
</body>
</html>
"""
        return html
