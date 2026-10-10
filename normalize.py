import os
import re

MATRIX_FILE = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\implementation-truth-matrix.md"
ARTIFACTS_FILE = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\parser-artifacts.md"

junk_titles = [
    "# Accounting & Finance Audit", "# AI & Content Domain Audit", "لیست ویژگی‌های یافت شده", "U,UOO3O U^UOU~U_UO?OUO UO UOO U?O O'O_U",
    "Backend", "Tests", "# Inventory & Manufacturing Audit", "﻿# Platform & Sync Audit",
    "1", "2", "3", "4", "5"
]

def is_junk(title):
    return any(j in title for j in junk_titles) or title in ["1", "2", "3", "4", "5", "Backend", "Tests"]

def normalize_matrix():
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
        
        # Determine if it's an artifact
        # Also let's check for "Customer Portal" duplicate. There are two!
        if is_junk(title):
            if "Audit" in title: reason = "Markdown Structural Section Title"
            elif title in ["1", "2", "3", "4", "5"]: reason = "Markdown Table Row Index"
            elif title in ["Backend", "Tests"]: reason = "Markdown Table Header"
            else: reason = "Parser Artifact"
            artifacts.append({'title': title, 'reason': reason, 'source': 'Various raw files'})
        else:
            real_features.append(line)

    # De-duplicate real features (e.g., Customer Portal)
    seen_titles = {}
    dedup_features = []
    for f_line in real_features:
        parts = [p.strip() for p in f_line.split('|')]
        title = parts[2]
        # normalize duplicate customer portal
        if "Customer Portal" in title and "4." in title:
            # It's a duplicate. Mark as artifact.
            artifacts.append({'title': title, 'reason': "Duplicate Feature from different domain", 'source': 'sales-pos.md vs customers-crm.md'})
            continue
        dedup_features.append(f_line)

    # Write parser-artifacts.md
    with open(ARTIFACTS_FILE, 'w', encoding='utf-8') as f:
        f.write("# Parser Artifacts\n\n")
        f.write("| Entry | Classification | Why | Source |\n")
        f.write("|---|---|---|---|\n")
        for a in artifacts:
            f.write(f"| {a['title']} | PARSER_ARTIFACT | {a['reason']} | {a['source']} |\n")

    # Re-build matrix
    counts = {"COMPLETE":0, "PARTIAL":0, "UI_ONLY":0, "BACKEND_ONLY":0, "INFRA_ONLY":0, "DB_ONLY":0, "TEST_ONLY":0, "MISSING":0, "BLOCKED":0, "UNKNOWN":0}
    for f_line in dedup_features:
        parts = [p.strip() for p in f_line.split('|')]
        st = parts[4]
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
        fp.write("- **Feature Implementation Readiness**: Low. Most features are PARTIAL due to unverified end-to-end data flow (missing test/UI links in deep processes like Manufacturing or CMS).\n")
        fp.write("- **Production Architecture Readiness**: Moderate. Baseline sync and workspace features exist, but cross-tenant bleed risks in DB schemas and unverified heavy sync conflicts restrict true production readiness.\n")

normalize_matrix()
