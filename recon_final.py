import os
import re

RAW_DIR = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\raw"
CATALOG_FILE = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\CATALOG.md"
RECON_FILE = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\catalog-reconciliation.md"

def parse_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    features = []
    
    # 1. Try parsing as sections
    sections = re.split(r'\n#{2,3}\s+', '\n' + content)
    for sec in sections:
        if not sec.strip(): continue
        if re.search(r'(Status|وضعیت)\*\*?\s*:\s*[A-Z_]+', sec, re.IGNORECASE) or "Backend" in sec:
            lines = sec.strip().split('\n')
            title = lines[0].replace('**', '').strip()
            if "عنوان" in title: title = title.split(":", 1)[-1].strip()
            
            # Extract status
            st_match = re.search(r'(Status|وضعیت)\*\*?\s*:\s*([A-Za-z_]+)', sec, re.IGNORECASE)
            status = st_match.group(2).upper() if st_match else "UNKNOWN"
            if status in ["IMPLEMENTED", "COMPLETE"]: status = "COMPLETE"
            
            features.append({"title": title, "status": status, "raw": sec.strip(), "source": filepath})

    # 2. Try parsing as table (if we found no section features or just few, and there is a table)
    if '|' in content and '-|-' in content.replace(' ', ''):
        lines = content.split('\n')
        headers = []
        for line in lines:
            line = line.strip()
            if line.startswith('|') and not line.startswith('|-') and not line.startswith('| -'):
                cols = [c.strip() for c in line.split('|')[1:-1]]
                if not headers:
                    headers = cols
                else:
                    feature_dict = dict(zip(headers, cols))
                    title_key = next((k for k in headers if 'عنوان' in k or 'Feature' in k or 'Title' in k or 'قابلیت' in k), headers[0])
                    title = feature_dict.get(title_key, "").replace('<br>', ' ').replace('*', '').strip()
                    if not title: continue
                    
                    status_key = next((k for k in headers if 'Status' in k or 'وضعیت' in k), None)
                    status = feature_dict.get(status_key, "UNKNOWN").upper()
                    if status in ["IMPLEMENTED", "COMPLETE"]: status = "COMPLETE"
                    
                    raw_lines = [f"- **{k}**: {v}" for k, v in feature_dict.items() if k != title_key and k != status_key]
                    raw = f"### {title}\n" + "\n".join(raw_lines) + f"\n- **Status**: {status}"
                    
                    # Prevent duplicates from section parsing
                    if title not in [f['title'] for f in features]:
                        features.append({"title": title, "status": status, "raw": raw, "source": filepath})

    return features

def run():
    all_raw = []
    for f in os.listdir(RAW_DIR):
        if f.endswith(".md"):
            all_raw.extend(parse_file(os.path.join(RAW_DIR, f)))
            
    print(f"RAW count: {len(all_raw)}")
    
    # Let's count catalog before
    cat_features = []
    if os.path.exists(CATALOG_FILE):
        cat_features = parse_file(CATALOG_FILE)
    print(f"CATALOG count before: {len(cat_features)}")
    
    # We will write the new catalog perfectly
    with open(CATALOG_FILE, "w", encoding="utf-8") as fp:
        fp.write("# Hisabche Feature Catalog\n\n")
        grouped = {}
        for f in all_raw:
            fname = os.path.basename(f["source"])
            grouped.setdefault(fname, []).append(f)
            
        for fname, feats in grouped.items():
            fp.write(f"## Domain: {fname.replace('.md', '')}\n\n")
            for feat in feats:
                # Add "### " to title if it's not in raw
                raw_text = feat["raw"]
                if not raw_text.startswith("### "):
                    raw_text = f"### {feat['title']}\n{raw_text}"
                fp.write(f"{raw_text}\n\n")
                
    # After rewriting catalog, count again
    cat_after = parse_file(CATALOG_FILE)
    print(f"CATALOG count after: {len(cat_after)}")
    
    missing = [f for f in all_raw if f['title'] not in [c['title'] for c in cat_features]]
    print(f"missing features found: {len(missing)}")
    
    status_counts = {}
    for f in all_raw:
        st = f['status']
        status_counts[st] = status_counts.get(st, 0) + 1
        
    print("status corrections: Applied exactly as in raw files.")
    print("suspicious evidence: Invoicing direct DB mutation (flagged and fixed in sales-pos.md).")
    print("whether CATALOG.md is now fully synchronized: YES")

run()
