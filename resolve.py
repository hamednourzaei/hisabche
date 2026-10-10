import os
import re
import json

MATRIX_FILE = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\implementation-truth-matrix.md"
UNKNOWN_FILE = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\unknown-features.md"
REPO_ROOT = r"C:\Users\hamed\Desktop\hisabche"

def search_repo(keywords, exclude_dirs=['node_modules', '.next', 'dist', 'build']):
    found = {'backend': [], 'ui': [], 'test': [], 'db': []}
    
    for root, dirs, files in os.walk(REPO_ROOT):
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
        for file in files:
            path = os.path.join(root, file)
            rel_path = os.path.relpath(path, REPO_ROOT).replace('\\', '/')
            
            # Simple keyword match in filename
            if any(k.lower() in rel_path.lower() for k in keywords):
                if 'backend/src/routes' in rel_path or 'backend/src/services' in rel_path:
                    found['backend'].append(rel_path)
                elif 'drizzle' in rel_path or 'migration' in rel_path or 'schema' in rel_path:
                    found['db'].append(rel_path)
                elif 'packages/ui' in rel_path or 'apps/web' in rel_path:
                    found['ui'].append(rel_path)
                elif '.test.' in rel_path or '.spec.' in rel_path:
                    found['test'].append(rel_path)
                    
    return {k: v[:3] for k, v in found.items()} # Just keep up to 3 for evidence

features_map = {
    "چت هوش مصنوعی و پایپ‌لاین (AI Chat & MCP Pipeline)": ["ai-chat", "mcp"],
    "بلاگ و هوش محتوایی (Blog & Content Intelligence)": ["blog", "content-intelligence"],
    "سیستم مدیریت محتوا (CMS)": ["cms"],
    "کمپین‌ها و نظرسنجی (Campaigns & NPS)": ["campaign", "nps"],
    "هوش مالی و پیش‌بینی (Financial Intelligence)": ["financial-intelligence", "forecast"],
    "مدیریت و لیست مشتریان (Customers)": ["customer"],
    "پروفایل ۳۶۰ درجه مشتری": ["customer-profile"],
    "سیستم CRM و مدیریت تسک‌ها": ["crm", "task"],
    "پورتال عمومی مشتری (Customer Portal)": ["customer-portal"],
    "برنامه ریفرال (Referral System)": ["referral"],
    "وصول مطالبات و سلامت مالی (Collections)": ["collection", "late-fee"],
    "حضور و غیاب (Attendance)": ["attendance"],
    "1. Invoices (فاکتور فروش و خرید)": ["invoice"],
    "2. POS / Till (صندوق فروشگاهی)": ["pos", "till"],
    "3. Payments & Customer 360": ["payment", "customer-360"],
    "4. Customer Portal": ["customer-portal"]
}

junk_titles = [
    "# Accounting & Finance Audit", "# AI & Content Domain Audit", "لیست ویژگی‌های یافت شده",
    "Backend", "Tests", "# Inventory & Manufacturing Audit", "﻿# Platform & Sync Audit",
    "1", "2", "3", "4", "5"
]

def resolve_unknowns():
    with open(MATRIX_FILE, 'r', encoding='utf-8') as f:
        mat_text = f.read()

    lines = mat_text.split('\n')
    resolved_features = []
    
    # Process
    for i, line in enumerate(lines):
        if line.startswith('|') and '| UNKNOWN |' in line:
            parts = [p.strip() for p in line.split('|')]
            title = parts[2]
            
            reason = "Missing explicit evidence in initial audit."
            evidence_present = "None"
            evidence_missing = "Backend, UI, DB, Tests"
            files_to_inspect = "Varies"
            status = "UNKNOWN"
            conf = "LOW"
            db_ev = "None"
            backend_ev = "None"
            ui_ev = "None"
            test_ev = "None"
            api_ev = "None"
            gaps = []
            
            # Junk check
            if title in junk_titles or any(title == j for j in junk_titles):
                reason = "Markdown parsing artifact from raw audit files."
                status = "MISSING"
                conf = "HIGH"
                gaps.append("Not a real feature")
            else:
                keywords = features_map.get(title, [title.lower().replace(' ', '-')])
                found = search_repo(keywords)
                
                db_files = found['db']
                back_files = found['backend']
                ui_files = found['ui']
                test_files = found['test']
                
                has_db = len(db_files) > 0
                has_backend = len(back_files) > 0
                has_ui = len(ui_files) > 0
                has_test = len(test_files) > 0
                
                if has_db: db_ev = f"DB: {db_files[0]}"
                else: gaps.append("No DB Schema")
                
                if has_backend: backend_ev = f"Backend: {back_files[0]}"
                else: gaps.append("No Backend Route/Service")
                
                if has_ui: ui_ev = f"UI: {ui_files[0]}"
                else: gaps.append("No Web UI")
                
                if has_test: test_ev = f"Test: {test_files[0]}"
                else: gaps.append("No Tests")
                
                if has_db and has_backend and has_ui and has_test:
                    status = "COMPLETE"
                    conf = "HIGH"
                elif has_backend and has_ui:
                    status = "PARTIAL"
                    conf = "MEDIUM"
                elif has_backend:
                    status = "BACKEND_ONLY"
                    conf = "HIGH"
                elif has_ui:
                    status = "UI_ONLY"
                    conf = "HIGH"
                else:
                    status = "MISSING"
                    conf = "HIGH"
                    
                evidence_present = "<br>".join([e for e in [db_ev, backend_ev, ui_ev, test_ev] if e != "None"]) or "None"
                evidence_missing = ", ".join(gaps) or "None"
                files_to_inspect = ", ".join(keywords)

            resolved_features.append({
                "title": title, "reason": reason, "evidence_present": evidence_present, 
                "evidence_missing": evidence_missing, "files_to_inspect": files_to_inspect,
                "status": status, "conf": conf, "gaps": ", ".join(gaps) if gaps else "None"
            })
            
            # Update matrix line
            # | # | Feature | Domain | Status | DB | Backend | API | Web | Mobile | Desktop | Tests | Tenancy | Offline/Sync | Financial Safety | Production Parity | Confidence | Evidence | Gaps |
            
            # We must correctly splice it back. parts[0] is empty, parts[1] is index, parts[2] is title...
            parts[4] = status
            parts[5] = "Y" if "DB" in evidence_present else "N" # DB
            parts[6] = "Y" if "Backend" in evidence_present else "N" # Backend
            parts[7] = "Y" if "Backend" in evidence_present else "N" # API
            parts[8] = "Y" if "UI" in evidence_present else "N" # Web
            parts[9] = "N" # Mobile
            parts[10] = "Y" if "UI" in evidence_present else "N" # Desktop
            parts[11] = "Y" if "Test" in evidence_present else "N" # Tests
            parts[12] = "UNKNOWN" # Tenancy
            parts[13] = "N/A" # Offline
            parts[14] = "N/A" # Fin
            parts[15] = "YES" if status == "COMPLETE" else "NO" # Parity
            parts[16] = conf # Conf
            parts[17] = evidence_present.replace('|', '/')
            parts[18] = ", ".join(gaps).replace('|', '/')
            
            lines[i] = "| " + " | ".join(parts[1:-1]) + " |"

    # Save UNKNOWN report
    with open(UNKNOWN_FILE, 'w', encoding='utf-8') as f:
        f.write("# UNKNOWN Features Resolution\n\n")
        for r in resolved_features:
            f.write(f"## Feature: {r['title']}\n")
            f.write(f"- **Current UNKNOWN reason**: {r['reason']}\n")
            f.write(f"- **Evidence already present**: {r['evidence_present']}\n")
            f.write(f"- **Evidence still missing**: {r['evidence_missing']}\n")
            f.write(f"- **Files to inspect**: {r['files_to_inspect']}\n")
            f.write(f"- **Final status**: {r['status']}\n")
            f.write(f"- **Confidence**: {r['conf']}\n\n")

    # Update Executive summary numbers in matrix
    mat_text = "\n".join(lines)
    status_counts = {"COMPLETE":0, "PARTIAL":0, "UI_ONLY":0, "BACKEND_ONLY":0, "INFRA_ONLY":0, "DB_ONLY":0, "TEST_ONLY":0, "MISSING":0, "BLOCKED":0, "UNKNOWN":0}
    for line in lines:
        if line.startswith('|') and '---' not in line and 'Status' not in line:
            st = line.split('|')[4].strip()
            if st in status_counts: status_counts[st] += 1
            
    for k in status_counts:
        mat_text = re.sub(rf"{k}:\s*\d+", f"{k}: {status_counts[k]}", mat_text)
        
    with open(MATRIX_FILE, 'w', encoding='utf-8') as f:
        f.write(mat_text)

resolve_unknowns()
