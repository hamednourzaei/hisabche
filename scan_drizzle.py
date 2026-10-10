import os
import re
import json

repo = r'C:\Users\hamed\Desktop\hisabche\backend\src'
tables = {}

for root, dirs, files in os.walk(repo):
    for f in files:
        if f.endswith('.ts'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            for m in re.finditer(r'pgTable\s*\(\s*[\'"]([^\'"]+)[\'"]\s*,([\s\S]*?)\)', content):
                t_name = m.group(1)
                t_body = m.group(2)
                tables[t_name] = {
                    'file': os.path.relpath(path, repo),
                    'user': 'user_id' in t_body or 'userId' in t_body,
                    'ws': 'workspace_id' in t_body or 'workspaceId' in t_body
                }

print("Drizzle tables user only:")
for t, v in tables.items():
    if v['user'] and not v['ws']:
        print(f"{t} in {v['file']}")
