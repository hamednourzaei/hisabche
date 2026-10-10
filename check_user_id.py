import os

repo = r'C:\Users\hamed\Desktop\hisabche\backend\src'
for root, dirs, files in os.walk(repo):
    if 'node_modules' in root: continue
    for f in files:
        if f.endswith('.ts'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            if ".eq('user_id'" in content or '.eq("user_id"' in content:
                print(os.path.relpath(path, repo))
