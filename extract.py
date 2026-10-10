import json
import re

with open('docs/feature-audit/CATALOG.md', 'r', encoding='utf-8') as f:
    text = f.read()

features = []
blocks = re.split(r'\n###\s+', '\n' + text)
for b in blocks:
    if not b.strip(): continue
    if re.search(r'(Status|وضعیت)\*\*?\s*:\s*[A-Z_]+', b, re.IGNORECASE) or "Backend" in b:
        lines = b.strip().split('\n')
        title = lines[0].replace('**', '').strip()
        features.append(title)

with open('features.json', 'w', encoding='utf-8') as f:
    json.dump(features, f, ensure_ascii=False, indent=2)
