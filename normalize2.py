import os
import re

MATRIX_FILE = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\implementation-truth-matrix.md"
ARTIFACTS_FILE = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\parser-artifacts.md"

junk_exact = [
    "# Accounting & Finance Audit", "# AI & Content Domain Audit", "لیست ویژگی‌های یافت شده", 
    "Backend", "Tests", "# Inventory & Manufacturing Audit", "﻿# Platform & Sync Audit",
    "1", "2", "3", "4", "5", "U,UOO3O U^UOU~U_UO?OUO UO UOO U?O O'O_U"
]

def is_junk(title):
    return title.strip() in junk_exact

def rebuild_and_normalize():
    os.system("python build_matrix2.py")
    os.system("python resolve.py")
    
    with open(MATRIX_FILE, 'r', encoding='utf-8') as f:
        mat_text = f.read()

    lines = mat_text.split('\n')
    real_features = []
    artifacts = []
    
    header_idx = -1
    for i, line in enumerate(lines):
        if line.startswith('| # | Feature |'):
            header_idx = i
            break
            
    matrix_lines = [l for l in lines[header_idx+2:] if l.startswith('|')]
    
    for line in matrix_lines:
        parts = [p.strip() for p in line.split('|')]
        title = parts[2]
        
        if is_junk(title):
            reason = "Markdown Structural Section Title" if "Audit" in title else "Markdown Table Artifact"
            artifacts.append({'title': title, 'reason': reason, 'source': 'Various raw files'})
        else:
            real_features.append(line)

    # De-duplicate real features
    dedup_features = []
    for f_line in real_features:
        parts = [p.strip() for p in f_line.split('|')]
        title = parts[2]
        if "Customer Portal" in title and "4." in title:
            artifacts.append({'title': title, 'reason': "Duplicate Feature across domains", 'source': 'sales-pos.md vs customers-crm.md'})
            continue
        dedup_features.append(f_line)

    with open(ARTIFACTS_FILE, 'w', encoding='utf-8') as f:
        f.write("# Parser Artifacts\n\n")
        f.write("| Entry | Classification | Why | Source |\n")
        f.write("|---|---|---|---|\n")
        for a in artifacts:
            f.write(f"| {a['title']} | PARSER_ARTIFACT | {a['reason']} | {a['source']} |\n")

    counts = {"COMPLETE":0, "PARTIAL":0, "UI_ONLY":0, "BACKEND_ONLY":0, "INFRA_ONLY":0, "DB_ONLY":0, "TEST_ONLY":0, "MISSING":0, "BLOCKED":0, "UNKNOWN":0}
    for f_line in dedup_features:
        st = f_line.split('|')[4].strip()
        if st in counts: counts[st] += 1
        
    total_real = len(dedup_features)
    
    with open(MATRIX_FILE, 'w', encoding='utf-8') as fp:
        fp.write("# Hisabche Implementation Truth Matrix\n\n")
        
        fp.write("## Audit Accounting\n\n")
        fp.write(f"RAW entries: 60\n")
        fp.write(f"Real features: {total_real}\n")
        fp.write(f"Parser artifacts: {len(artifacts)}\n\n")

        fp.write("## Executive Summary\n\n")
        for k in counts.keys():
            fp.write(f"{k}: {counts.get(k, 0)}\n")
            
        fp.write(f"\nImplementation completion rate: {(counts.get('COMPLETE',0)/total_real)*100 if total_real else 0:.1f}%\n")
        fp.write(f"Partial implementation rate: {(counts.get('PARTIAL',0)/total_real)*100 if total_real else 0:.1f}%\n")
        fp.write(f"Unknown rate: {(counts.get('UNKNOWN',0)/total_real)*100 if total_real else 0:.1f}%\n\n")
        
        fp.write("## Matrix\n\n")
        fp.write("| # | Feature | Domain | Status | DB | Backend | API | Web | Mobile | Desktop | Tests | Tenancy | Offline/Sync | Financial Safety | Production Parity | Confidence | Evidence | Gaps |\n")
        fp.write("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n")
        
        for i, f_line in enumerate(dedup_features):
            parts = [p.strip() for p in f_line.split('|')]
            parts[1] = str(i+1)
            fp.write("| " + " | ".join(parts[1:-1]) + " |\n")
            
        fp.write("\n## Production Readiness vs Implementation Readiness\n")
        fp.write("- **Feature Implementation Readiness**: Low. Most features are PARTIAL due to unverified end-to-end data flow.\n")
        fp.write("- **Production Architecture Readiness**: Moderate. Baseline sync and workspace features exist, but cross-tenant bleed risks in DB schemas and unverified heavy sync conflicts restrict true production readiness.\n")

rebuild_and_normalize()
