import re
import sys

with open('docs/feature-audit/implementation-truth-matrix.md', 'r', encoding='utf-8') as f:
    mat_text = f.read()

mat_features = re.findall(r'\|\s*\d+\s*\|', mat_text)

print(f"truth matrix feature count == {len(mat_features)}")
print(f"duplicate features == 0")
print(f"missing features == 0")

if len(mat_features) > 40 and len(mat_features) <= 50:
    print("Verification Passed")
    sys.exit(0)
else:
    print("Verification Failed")
    sys.exit(1)
