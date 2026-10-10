import os
import re

RAW_DIR = "docs/feature-audit/raw"
CATALOG_FILE = "docs/feature-audit/CATALOG.md"
RECON_FILE = "docs/feature-audit/catalog-reconciliation.md"

def extract_features(text):
    blocks = re.split(r'\n###\s+|\nعنوان:\s+', text)
    res = []
    for b in blocks:
        if "توضیحات:" in b or "توضیحات**:" in b:
            title = b.split('\n')[0].replace('**','').strip()
            status_match = re.search(r'Status\*\*?:\s*([A-Z_]+)', b)
            status = status_match.group(1) if status_match else "UNKNOWN"
            suspicious = []
            
            # Check invoicing specifically
            if "فاکتور" in title or "Invoices" in title:
                if "supabase/postgrest" in b.lower() or "postgrest" in b.lower():
                    suspicious.append("Invoicing uses supabase/postgrest directly for mutations - this is an architecture violation (bypasses domain engine).")

            # Missing frontend/backend check
            if "COMPLETE" in status:
                ui_match = re.search(r'Frontend\*\*?:(.*)', b, re.IGNORECASE)
                backend_match = re.search(r'Backend\*\*?:(.*)', b, re.IGNORECASE)
                if not ui_match or 'not found' in ui_match.group(1).lower() or 'none' in ui_match.group(1).lower() or not ui_match.group(1).strip():
                    suspicious.append("Claimed COMPLETE but lacks explicit UI evidence")
                if not backend_match or 'not found' in backend_match.group(1).lower() or 'none' in backend_match.group(1).lower() or not backend_match.group(1).strip():
                    suspicious.append("Claimed COMPLETE but lacks explicit Backend evidence")

            res.append({"title": title, "status": status, "suspicious": suspicious, "raw": "### " + title + "\n" + b.strip()})
    return res

def run():
    raw_features = []
    raw_titles = set()
    raw_counts = {"COMPLETE":0, "PARTIAL":0, "BACKEND_ONLY":0, "UI_ONLY":0, "WIRED_BUT_UNVERIFIED":0, "EXISTS_BUT_UNUSED":0, "PLANNED_ONLY":0, "NOT_FOUND":0}
    
    for f in os.listdir(RAW_DIR):
        if not f.endswith(".md"): continue
        with open(os.path.join(RAW_DIR, f), "r", encoding="utf-8") as fp:
            feats = extract_features(fp.read())
            for feat in feats:
                feat["file"] = f
                raw_features.append(feat)
                raw_titles.add(feat["title"])
                if feat["status"] in raw_counts:
                    raw_counts[feat["status"]] += 1
                else:
                    raw_counts[feat["status"]] = 1

    with open(CATALOG_FILE, "r", encoding="utf-8") as fp:
        cat_text = fp.read()
        cat_features = extract_features(cat_text)
        cat_titles = {f["title"] for f in cat_features}
        
    missing_from_cat = [f for f in raw_features if f["title"] not in cat_titles]
            
    with open(RECON_FILE, "w", encoding="utf-8") as fp:
        fp.write("# Catalog Reconciliation\n\n")
        fp.write(f"- RAW feature count: {len(raw_features)}\n")
        fp.write(f"- CATALOG feature count before: {len(cat_features)}\n")
        fp.write(f"- Missing from catalog: {len(missing_from_cat)}\n")
        
        fp.write("\n## Missing Features (To be restored)\n")
        for m in missing_from_cat:
            fp.write(f"- {m['title']} ({m['file']})\n")
            
        fp.write("\n## Suspicious Evidence / Architecture Violations\n")
        for f in raw_features:
            if f["suspicious"]:
                fp.write(f"- **{f['title']}**: {', '.join(f['suspicious'])}\n")
            
        fp.write("\n## Final Reconciled Counts\n")
        fp.write(f"Total Features: {len(raw_features)}\n")
        for k, v in raw_counts.items():
            fp.write(f"{k}: {v}\n")
            
    # Update CATALOG.md
    with open(CATALOG_FILE, "w", encoding="utf-8") as fp:
        fp.write("# Hisabche Feature Catalog\n\n")
        # simple dump of all raw features grouped by file
        grouped = {}
        for f in raw_features:
            grouped.setdefault(f["file"], []).append(f)
            
        for file, feats in grouped.items():
            fp.write(f"\n## Domain: {file.replace('.md', '')}\n")
            for feat in feats:
                fp.write("\n" + feat["raw"] + "\n")
                
        fp.write("\n## Total Features Found: " + str(len(raw_features)) + "\n")
        fp.write(" / ".join([f"{k}: {v}" for k,v in raw_counts.items()]) + "\n")

run()
