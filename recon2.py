import os
import re

RAW_DIR = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\raw"
CATALOG_FILE = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\CATALOG.md"
RECON_FILE = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\catalog-reconciliation.md"

def extract_features(text):
    # Features can start with "### title", "عنوان:", "- **عنوان**:"
    # We will split by double newline and look for blocks that look like features
    res = []
    
    # Try splitting by `### `
    blocks = re.split(r'\n###\s+', '\n' + text)
    for b in blocks:
        if not b.strip(): continue
        # if it contains a status field, it's a feature
        if re.search(r'Status\*\*?\s*:\s*[A-Z_]+', b) or re.search(r'وضعیت\*\*?\s*:\s*[A-Z_]+', b) or "Status" in b:
            lines = b.strip().split('\n')
            title = lines[0].replace('**', '').strip()
            if "عنوان" in title:
                title = title.split(":", 1)[-1].strip()
            
            # extract status
            status_match = re.search(r'Status\*\*?\s*:\s*([A-Z_]+)', b)
            if not status_match:
                status_match = re.search(r'وضعیت\*\*?\s*:\s*([A-Z_a-z]+)', b)
            status = status_match.group(1).upper() if status_match else "UNKNOWN"
            
            # normalize Persian strings in status if any
            if "PARTIAL" in b.upper() and not status_match: status = "PARTIAL"
            elif "COMPLETE" in b.upper() and not status_match: status = "COMPLETE"
            
            # check suspicious
            suspicious = []
            if "postgrest" in b.lower() and ("invoice" in title.lower() or "فاکتور" in title):
                suspicious.append("Invoicing uses supabase/postgrest directly - architecture violation")
            
            res.append({"title": title, "status": status, "raw": b.strip(), "suspicious": suspicious})
            
    # if empty, try splitting by `- **عنوان**:`
    if not res:
        blocks = re.split(r'\n-\s*\*\*عنوان\*\*:', '\n' + text)
        for b in blocks[1:]:
            title = b.split('\n')[0].strip()
            status_match = re.search(r'Status\*\*?\s*:\s*([A-Z_]+)', b)
            status = status_match.group(1) if status_match else "UNKNOWN"
            res.append({"title": title, "status": status, "raw": "- **عنوان**: " + b.strip(), "suspicious": []})

    return res

def run():
    raw_features = []
    raw_counts = {"COMPLETE":0, "PARTIAL":0, "BACKEND_ONLY":0, "UI_ONLY":0, "WIRED_BUT_UNVERIFIED":0, "EXISTS_BUT_UNUSED":0, "PLANNED_ONLY":0, "NOT_FOUND":0}
    
    for f in os.listdir(RAW_DIR):
        if not f.endswith(".md"): continue
        with open(os.path.join(RAW_DIR, f), "r", encoding="utf-8") as fp:
            feats = extract_features(fp.read())
            for feat in feats:
                feat["file"] = f
                raw_features.append(feat)
                st = feat["status"]
                if st not in raw_counts: raw_counts[st] = 0
                raw_counts[st] += 1

    cat_features = []
    if os.path.exists(CATALOG_FILE):
        with open(CATALOG_FILE, "r", encoding="utf-8") as fp:
            cat_features = extract_features(fp.read())
            
    cat_count_before = len(cat_features)
    raw_count = len(raw_features)
    
    # Missing features
    cat_titles = [f["title"].lower() for f in cat_features]
    missing = []
    for r in raw_features:
        if r["title"].lower() not in cat_titles:
            missing.append(r)

    # Rebuild Catalog
    # we don't really do full deduplication in this quick script, we just append missing.
    # Actually, the user says "Then update CATALOG.md from the verified raw audits."
    # I will just write all raw_features grouped by file as the new CATALOG to ensure 100% sync.
    with open(CATALOG_FILE, "w", encoding="utf-8") as fp:
        fp.write("# Hisabche Feature Catalog\n\n")
        grouped = {}
        for f in raw_features:
            grouped.setdefault(f["file"], []).append(f)
            
        for file, feats in grouped.items():
            fp.write(f"\n## Domain: {file.replace('.md', '')}\n\n")
            for feat in feats:
                fp.write(f"### {feat['title']}\n{feat['raw']}\n\n")
                
        fp.write(f"\n## Total Features Found: {raw_count}\n")
        summary_str = " / ".join([f"{k}: {v}" for k,v in raw_counts.items()])
        fp.write(summary_str + "\n")

    print(f"RAW count: {raw_count}")
    print(f"CATALOG count before: {cat_count_before}")
    print(f"CATALOG count after: {raw_count}")
    print(f"missing features found: {len(missing)}")
    
run()
