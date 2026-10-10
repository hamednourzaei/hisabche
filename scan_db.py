import os
import re

REPO_ROOT = r'C:\Users\hamed\Desktop\hisabche'
SCHEMA_DIR = os.path.join(REPO_ROOT, 'backend', 'src', 'db', 'schema')

tables = {}

# We also check supabase migrations for RLS
MIGRATION_DIR = os.path.join(REPO_ROOT, 'supabase', 'migrations')

def scan_schemas():
    if not os.path.exists(SCHEMA_DIR):
        print(f"Schema dir not found: {SCHEMA_DIR}")
        return
        
    for root, dirs, files in os.walk(SCHEMA_DIR):
        for file in files:
            if file.endswith('.ts'):
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Regex to find pgTable declarations
                # e.g., export const users = pgTable('users', { ... })
                table_matches = re.finditer(r'pgTable\s*\(\s*[\'"]([^\'"]+)[\'"]\s*,([\s\S]*?)(?=\);|pgTable)', content)
                for match in table_matches:
                    t_name = match.group(1)
                    t_body = match.group(2)
                    has_user = 'user_id' in t_body or 'userId' in t_body
                    has_workspace = 'workspace_id' in t_body or 'workspaceId' in t_body
                    tables[t_name] = {
                        'has_user': has_user, 
                        'has_workspace': has_workspace, 
                        'file': file,
                        'body': t_body
                    }

scan_schemas()

target_tables = {k: v for k, v in tables.items() if v['has_user'] and not v['has_workspace']}

print(f"Total tables found: {len(tables)}")
print(f"Tables with user_id but no workspace_id: {len(target_tables)}")
for k, v in target_tables.items():
    print(f"- {k} ({v['file']})")

import json
with open('target_tables.json', 'w') as f:
    json.dump(target_tables, f, indent=2)
