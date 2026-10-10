import os
import re

raw_dir = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\raw"
out_file = r"C:\Users\hamed\Desktop\hisabche\docs\feature-audit\CATALOG.md"

# Define the categories
categories = {
    "فروش": [],
    "مشتری": [],
    "موجودی": [],
    "خرید": [],
    "حسابداری": [],
    "نقدینگی": [],
    "تولید": [],
    "منابع انسانی": [],
    "گزارش": [],
    "هوش مصنوعی": [],
    "آفلاین": [],
    "دسترسی و امنیت": [],
    "اتوماسیون": [],
    "توسعه‌دهندگان": [],
    "Marketplace": [],
    "پلتفرم": []
}

def get_title_key(feature):
    for k in feature.keys():
        if 'عنوان' in k:
            return k
    return None

def parse_markdown_sections(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    parsed = []
    headers = []
    for line in lines:
        line = line.strip()
        if line.startswith('|') and not line.startswith('|---') and not line.startswith('| ---'):
            cols = [c.strip() for c in line.split('|')[1:-1]]
            if not headers:
                headers = cols
            else:
                feature = dict(zip(headers, cols))
                if get_title_key(feature):
                    title_key = get_title_key(feature)
                    feature['عنوان'] = feature.pop(title_key)
                    for k in list(feature.keys()):
                        if 'status' in k.lower() or 'وضعیت' in k.lower():
                            feature['Status'] = feature.pop(k)
                    for k in list(feature.keys()):
                        if 'frontend' in k.lower() or 'فرانت' in k.lower():
                            feature['Frontend'] = feature.pop(k)
                    parsed.append(feature)
    return parsed

def parse_markdown_sections(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    sections = re.split(r'\n#{2,3}\s+', '\n' + content)
    parsed = []
    for sec in sections:
        if not sec.strip(): continue
        lines = sec.strip().split('\n')
        
        feature = {}
        for line in lines:
            line = line.strip()
            if line.startswith('- **') or line.startswith('- '):
                match = re.match(r'-\s*\**([^\*:]+)\**:\s*(.*)', line)
                if match:
                    k, v = match.groups()
                    feature[k.strip()] = v.strip()
            elif line.startswith('عنوان:'):
                feature['عنوان'] = line.replace('عنوان:', '').strip()
            elif ':' in line and not line.startswith('#'):
                k, v = line.split(':', 1)
                feature[k.strip()] = v.strip()
                
        if get_title_key(feature):
            title_key = get_title_key(feature)
            if title_key != 'عنوان':
                feature['عنوان'] = feature.pop(title_key)
            parsed.append(feature)
            
    if 'ecosystem.md' in filepath:
        feature = {}
        sec_splits = re.split(r'\n##\s+', '\n' + content)
        for s in sec_splits:
            if not s.strip(): continue
            slines = s.strip().split('\n')
            k = slines[0].strip()
            v = '\n'.join(slines[1:]).strip()
            if k == 'Ecosystem & Workflow' or 'market, commerce' in k:
                feature['عنوان'] = k
            else:
                feature[k] = v.replace('- ', '')
        if get_title_key(feature):
            title_key = get_title_key(feature)
            if title_key != 'عنوان':
                feature['عنوان'] = feature.pop(title_key)
            parsed.append(feature)
            
    return parsed

# Process files
files = {
    "accounting.md": parse_markdown_sections,
    "ai-content.md": parse_markdown_sections,
    "customers-crm.md": parse_markdown_sections,
    "ecosystem.md": parse_markdown_sections,
    "hr.md": parse_markdown_sections,
    "inventory.md": parse_markdown_sections,
    "platform.md": parse_markdown_sections,
    "purchasing.md": parse_markdown_sections,
    "reports.md": parse_markdown_sections,
    "sales-pos.md": parse_markdown_sections
}

all_raw_features = []
for fname, parser in files.items():
    fpath = os.path.join(raw_dir, fname)
    if os.path.exists(fpath):
        feats = parser(fpath)
        for f in feats:
            f['_source'] = fname
        all_raw_features.extend(feats)

# Merge Logic
def find_feature_by_title_and_source(title_substr, source):
    for f in all_raw_features:
        if title_substr.lower() in f.get('عنوان', '').lower() and f['_source'] == source:
            return f
    return None

# Duplicate 1: Customer Portal
crm_portal = find_feature_by_title_and_source('پورتال عمومی مشتری', 'customers-crm.md')
sales_portal = find_feature_by_title_and_source('customer portal', 'sales-pos.md')
if crm_portal and sales_portal:
    sales_portal['Backend'] = sales_portal.get('Backend', '') + ' | ' + crm_portal.get('مسیرهای Backend / API', crm_portal.get('Backend', ''))
    sales_portal['Frontend'] = sales_portal.get('Frontend', '') + ' | ' + crm_portal.get('مسیرهای Frontend / UI', crm_portal.get('Frontend', ''))
    sales_portal['توضیحات (Merged)'] = crm_portal.get('توضیحات', '')
    all_raw_features.remove(crm_portal)

# Duplicate 2: Customer 360
crm_360 = find_feature_by_title_and_source('پروفایل ۳۶۰ درجه مشتری', 'customers-crm.md')
sales_360 = find_feature_by_title_and_source('payments & customer 360', 'sales-pos.md')
if crm_360 and sales_360:
    sales_360['Backend'] = sales_360.get('Backend', '') + ' | ' + crm_360.get('مسیرهای Backend / API', crm_360.get('Backend', ''))
    sales_360['Frontend'] = sales_360.get('Frontend', '') + ' | ' + crm_360.get('مسیرهای Frontend / UI', crm_360.get('Frontend', ''))
    sales_360['توضیحات (Merged)'] = crm_360.get('توضیحات', '')
    all_raw_features.remove(crm_360)

# Duplicate 3: Financial & Profit Reports
acc_reports = find_feature_by_title_and_source('گزارش‌های مالی', 'accounting.md')
rep_reports = find_feature_by_title_and_source('operational & profit', 'reports.md')
if acc_reports and rep_reports:
    rep_reports['Backend'] = rep_reports.get('Backend', '') + ' | ' + acc_reports.get('Backend', '')
    rep_reports['Frontend'] = rep_reports.get('Frontend', '') + ' | ' + acc_reports.get('Frontend', '')
    rep_reports['توضیحات (Merged)'] = acc_reports.get('توضیحات', '')
    all_raw_features.remove(acc_reports)

# Duplicate 4: OAuth Platform
plat_oauth = find_feature_by_title_and_source('پلتفرم توسعه‌دهندگان', 'platform.md')
eco_oauth = find_feature_by_title_and_source('ecosystem & workflow', 'ecosystem.md')
if plat_oauth and eco_oauth:
    eco_oauth['Backend'] = eco_oauth.get('Backend', '') + '\n[Merged from Platform]: ' + plat_oauth.get('Backend', '')
    eco_oauth['Frontend'] = eco_oauth.get('Frontend', '') + '\n[Merged from Platform]: ' + plat_oauth.get('Frontend', '')
    eco_oauth['توضیحات (Merged from Platform)'] = plat_oauth.get('توضیحات', '')
    all_raw_features.remove(plat_oauth)

# Determine Status & Categories
for f in all_raw_features:
    title = f.get('عنوان', '').lower()
    
    status = f.get('Status', 'COMPLETE')
    if 'پیاده‌سازی' in status or 'Implemented' in status or 'COMPLETE' in status or 'فعال' in status:
        status = 'COMPLETE'
        
    if 'سیستم مدیریت محتوا (cms)' in title:
        status = 'PARTIAL'
    elif 'وصول مطالبات و سلامت مالی' in title:
        status = 'PARTIAL'
    elif 'پیشنهاد سفارش مجدد' in title:
        status = 'PARTIAL'
    elif 'حضور و غیاب' in title:
        status = 'PARTIAL'
    elif 'مدیریت کارمندان و تیم' in title:
        status = 'PARTIAL'
        
    fr = f.get('Frontend', '')
    if fr == '-' or fr.strip() == '' or 'نامشخص' in fr or 'یافت نشد' in fr:
        if status != 'PARTIAL':
            status = 'BACKEND_ONLY'
        
    if 'زیرساختی' in f.get('Status', '') or 'Infrastructure' in f.get('Status', ''):
        status = 'WIRED_BUT_UNVERIFIED'
        
    f['Status'] = status
    
    # Categorize
    cat = 'پلتفرم'
    if f['_source'] == 'sales-pos.md':
        cat = 'فروش'
        if 'payments' in title or 'customer' in title:
            cat = 'مشتری'
    elif f['_source'] == 'customers-crm.md':
        cat = 'مشتری'
    elif f['_source'] == 'inventory.md':
        cat = 'موجودی'
        if 'تولید' in title or 'manufacturing' in title:
            cat = 'تولید'
    elif f['_source'] == 'purchasing.md':
        cat = 'خرید'
        if 'sales orders' in title or 'استورفرانت' in title:
            cat = 'فروش'
    elif f['_source'] == 'accounting.md':
        cat = 'حسابداری'
        if 'بانک' in title or 'تامین مالی' in title or 'کیف پول' in title:
            cat = 'نقدینگی'
    elif f['_source'] == 'hr.md':
        cat = 'منابع انسانی'
    elif f['_source'] == 'reports.md':
        cat = 'گزارش'
        if 'ai insights' in title:
            cat = 'هوش مصنوعی'
    elif f['_source'] == 'ai-content.md':
        cat = 'هوش مصنوعی'
        if 'کمپین‌ها' in title:
            cat = 'مشتری'
    elif f['_source'] == 'platform.md':
        if 'sync' in title or 'همگام‌سازی' in title or 'conflict' in title or 'تداخلات' in title:
            cat = 'آفلاین'
        elif 'auth' in title or 'محیط کار' in title or 'شعب' in title:
            cat = 'دسترسی و امنیت'
        elif 'oauth' in title or 'توسعه‌دهندگان' in title:
            cat = 'توسعه‌دهندگان'
        else:
            cat = 'پلتفرم'
    elif f['_source'] == 'ecosystem.md':
        cat = 'اتوماسیون'

    f['_cat'] = cat
    categories[cat].append(f)

# Output generation
out_lines = ["# Hisabche Feature Audit Catalog\n"]

count_complete = 0
count_partial = 0
count_backend = 0
count_ui = 0
count_wired = 0
count_unused = 0
count_planned = 0
count_notfound = 0

for cat in categories.keys():
    out_lines.append(f"## {cat}")
    for f in categories[cat]:
        out_lines.append(f"### {f['عنوان']}")
        for k, v in f.items():
            if k in ['عنوان', '_source', '_cat']: continue
            out_lines.append(f"- **{k}**: {v}")
        out_lines.append("")
        
        st = f['Status']
        if st == 'COMPLETE': count_complete += 1
        elif st == 'PARTIAL': count_partial += 1
        elif st == 'BACKEND_ONLY': count_backend += 1
        elif st == 'UI_ONLY': count_ui += 1
        elif st == 'WIRED_BUT_UNVERIFIED': count_wired += 1
        elif st == 'EXISTS_BUT_UNUSED': count_unused += 1
        elif st == 'PLANNED_ONLY': count_planned += 1
        elif st == 'NOT_FOUND': count_notfound += 1

out_lines.append("")
total_found = count_complete + count_partial + count_backend + count_ui + count_wired + count_unused + count_planned + count_notfound
out_lines.append(f"Total Features Found: {total_found}")
out_lines.append(f"COMPLETE: {count_complete} / PARTIAL: {count_partial} / BACKEND_ONLY: {count_backend} / UI_ONLY: {count_ui} / WIRED_BUT_UNVERIFIED: {count_wired} / EXISTS_BUT_UNUSED: {count_unused} / PLANNED_ONLY: {count_planned} / NOT_FOUND: {count_notfound}")

with open(out_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out_lines))

print(f"Total after deduplication: {total_found}")
