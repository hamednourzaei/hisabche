import { readFileSync, writeFileSync } from 'node:fs'

const root = 'C:/Users/hamed/Desktop/hisabche'

const en = {
  usage: {
    title: 'Token usage and cost',
    description:
      'Questions, tokens and cost per day, from what the provider reported and the prices you entered.',
    day: 'Day',
    provider: 'Provider',
    model: 'Model',
    queries: 'Questions',
    promptTokens: 'Prompt tokens',
    completionTokens: 'Response tokens',
    cost: 'Cost',
    unpriced: 'Unpriced',
    unpricedHint:
      'A cost of “—” means no price row matches that model; its cost is unknown, not zero.',
    empty: 'No questions in this range',
    emptyHint: 'Usage appears here after the assistant answers a question.',
    loadFailed: 'Could not read usage',
    range: { '24h': '24 hours', '7d': '7 days', '30d': '30 days', '90d': '90 days' },
  },
  price: {
    title: 'Model prices',
    description: 'What you pay per million tokens. Entered by hand — nothing is guessed.',
    currency: 'Currency',
    input: 'Input / million',
    output: 'Output / million',
    actions: 'Actions',
    add: 'Add price',
    empty: 'No prices yet',
    emptyHint: 'Until a model has a price, its cost stays unknown.',
    hint: 'Amounts are in the currency’s own unit (for example 3.00 USD per million tokens), not minor units.',
    confirmTitle: 'Save this price?',
    confirmDesc: 'The price applies from now on; it never rewrites past costs.',
    deleteTitle: 'Delete this price?',
    deleteDesc: 'Questions already priced keep their recorded cost; new questions become unpriced.',
  },
  fallback: {
    title: 'Fallback chain',
    description:
      'Tried in order only when the primary provider fails (timeout, 429, 5xx) — never when it refuses.',
    position: 'Try #{position}',
    timeout: 'Timeout (ms)',
    enabled: 'Enabled',
    add: 'Add fallback',
    remove: 'Remove',
    empty: 'No fallback configured',
    emptyHint:
      'If the primary provider goes down, questions fail. A fallback keeps the assistant answering.',
    loadFailed: 'Could not read the fallback list',
    confirmTitle: 'Save the fallback chain?',
    confirmDesc: 'Saves {count} entries. Each one needs a model name.',
  },
  budgets: {
    title: 'Spending budgets',
    description: 'A ceiling per currency. A budget is a limit, not an estimate.',
    scope: 'Scope',
    scopeName: { platform: 'Platform', workspace: 'Workspace' },
    currency: 'Currency',
    limit: 'Monthly limit',
    spent: 'Spent this month',
    percent: 'Used',
    alertPercent: 'Alert at',
    actions: 'Actions',
    add: 'Save budget',
    empty: 'No budget set',
    emptyHint: 'Without a budget nothing stops spending; you only see it afterwards.',
    hint: 'Entered in the currency’s own unit and stored as exact minor-unit integers.',
    loadFailed: 'Could not read budgets',
    confirmTitle: 'Save this budget?',
    confirmDesc: 'The alert fires once a month when spend crosses the percentage.',
    deleteTitle: 'Delete this budget?',
    deleteDesc: 'The ceiling is removed; spending continues to be recorded.',
  },
  prompts: {
    title: 'Prompt versions',
    description:
      'Every saved system prompt, append-only. “Use” prefills the form above; saving appends a new version.',
    version: 'Version',
    createdAt: 'Saved at',
    createdBy: 'By',
    content: 'Text',
    actions: 'Actions',
    use: 'Use',
    empty: 'No saved versions yet',
    emptyHint: 'The first save of the system prompt creates version 1.',
    loadFailed: 'Could not read prompt versions',
  },
  audit: {
    title: 'AI audit trail',
    description:
      'Configuration and key changes, and a count of questions. Questions and answers are not shown.',
    event: 'Event',
    actor: 'By',
    at: 'When',
    details: 'Details',
    empty: 'No AI events yet',
    emptyHint: 'Save the configuration or test a connection and it appears here.',
    loadFailed: 'Could not read AI events',
  },
  section: {
    config: 'Provider',
    fallback: 'Fallback',
    usage: 'Usage',
    budgets: 'Budgets',
    prompts: 'Prompts',
    audit: 'Audit',
  },
}

const fa = {
  usage: {
    title: 'مصرف توکن و هزینه',
    description:
      'پرسش، توکن و هزینه به تفکیک روز، از پاسخ ارائه‌دهنده و قیمت‌هایی که خودتان وارد کرده‌اید.',
    day: 'روز',
    provider: 'ارائه‌دهنده',
    model: 'مدل',
    queries: 'پرسش',
    promptTokens: 'توکن پرسش',
    completionTokens: 'توکن پاسخ',
    cost: 'هزینه',
    unpriced: 'بدون قیمت',
    unpricedHint: 'هزینهٔ «—» یعنی هیچ قیمتی برای آن مدل ثبت نشده؛ هزینه ناشناخته است، نه صفر.',
    empty: 'در این بازه پرسشی ثبت نشده',
    emptyHint: 'پس از پاسخ دستیار، مصرف اینجا نمایش داده می‌شود.',
    loadFailed: 'خواندن مصرف ممکن نشد',
    range: { '24h': '۲۴ ساعت', '7d': '۷ روز', '30d': '۳۰ روز', '90d': '۹۰ روز' },
  },
  price: {
    title: 'قیمت مدل‌ها',
    description:
      'هزینه‌ای که به‌ازای هر میلیون توکن می‌پردازید؛ دستی وارد می‌شود و هیچ قیمتی حدس زده نمی‌شود.',
    currency: 'ارز',
    input: 'ورودی / میلیون',
    output: 'خروجی / میلیون',
    actions: 'عملیات',
    add: 'افزودن قیمت',
    empty: 'هنوز قیمتی ثبت نشده',
    emptyHint: 'تا وقتی قیمتی برای مدل ثبت نشود، هزینهٔ آن ناشناخته می‌ماند.',
    hint: 'مبلغ به واحد خودِ ارز است (مثلاً ۳٫۰۰ دلار برای هر میلیون توکن)، نه به واحد خرد.',
    confirmTitle: 'این قیمت ذخیره شود؟',
    confirmDesc: 'قیمت از این پس اعمال می‌شود و هزینه‌های گذشته را بازنویسی نمی‌کند.',
    deleteTitle: 'این قیمت حذف شود؟',
    deleteDesc: 'هزینهٔ پرسش‌های قبلی حفظ می‌شود؛ پرسش‌های بعدی بدون قیمت می‌مانند.',
  },
  fallback: {
    title: 'زنجیرهٔ جایگزین',
    description:
      'فقط وقتی ارائه‌دهندهٔ اصلی خطا بدهد (پایان مهلت، ۴۲۹، ۵xx) به ترتیب امتحان می‌شود؛ هرگز وقتی درخواست را رد کند.',
    position: 'تلاش {position}',
    timeout: 'مهلت (میلی‌ثانیه)',
    enabled: 'فعال',
    add: 'افزودن جایگزین',
    remove: 'حذف',
    empty: 'جایگزینی تنظیم نشده',
    emptyHint:
      'اگر ارائه‌دهندهٔ اصلی از کار بیفتد، پرسش‌ها شکست می‌خورند. جایگزین دستیار را پاسخ‌گو نگه می‌دارد.',
    loadFailed: 'خواندن فهرست جایگزین ممکن نشد',
    confirmTitle: 'زنجیرهٔ جایگزین ذخیره شود؟',
    confirmDesc: '{count} مورد ذخیره می‌شود؛ هر مورد باید نام مدل داشته باشد.',
  },
  budgets: {
    title: 'بودجهٔ مصرف',
    description: 'سقفی برای هر ارز؛ بودجه یک محدودیت است، نه برآورد.',
    scope: 'دامنه',
    scopeName: { platform: 'پلتفرم', workspace: 'فضای کاری' },
    currency: 'ارز',
    limit: 'سقف ماهانه',
    spent: 'هزینهٔ این ماه',
    percent: 'درصد مصرف',
    alertPercent: 'هشدار در',
    actions: 'عملیات',
    add: 'ذخیرهٔ بودجه',
    empty: 'بودجه‌ای تعیین نشده',
    emptyHint: 'بدون بودجه چیزی جلوی هزینه را نمی‌گیرد؛ فقط بعداً آن را می‌بینید.',
    hint: 'به واحد خودِ ارز وارد می‌شود و به‌صورت عدد صحیح واحد خرد ذخیره می‌گردد.',
    loadFailed: 'خواندن بودجه‌ها ممکن نشد',
    confirmTitle: 'این بودجه ذخیره شود؟',
    confirmDesc: 'وقتی مصرف از درصد تعیین‌شده بگذرد، هشدار ماهی یک بار فرستاده می‌شود.',
    deleteTitle: 'این بودجه حذف شود؟',
    deleteDesc: 'سقف برداشته می‌شود؛ ثبت هزینه ادامه دارد.',
  },
  prompts: {
    title: 'نسخه‌های دستور',
    description:
      'هر دستور سیستمی که ذخیره شده، فقط افزودنی. «استفاده» فرم بالا را پر می‌کند و ذخیره، نسخهٔ تازه می‌سازد.',
    version: 'نسخه',
    createdAt: 'زمان ذخیره',
    createdBy: 'توسط',
    content: 'متن',
    actions: 'عملیات',
    use: 'استفاده',
    empty: 'هنوز نسخه‌ای ذخیره نشده',
    emptyHint: 'نخستین ذخیرهٔ دستور سیستمی، نسخهٔ ۱ را می‌سازد.',
    loadFailed: 'خواندن نسخه‌های دستور ممکن نشد',
  },
  audit: {
    title: 'گزارش رخدادهای هوش مصنوعی',
    description: 'تغییر تنظیمات و کلید، و شمار پرسش‌ها. متن پرسش و پاسخ نمایش داده نمی‌شود.',
    event: 'رخداد',
    actor: 'توسط',
    at: 'زمان',
    details: 'جزئیات',
    empty: 'هنوز رخدادی ثبت نشده',
    emptyHint: 'ذخیرهٔ تنظیمات یا آزمایش اتصال اینجا دیده می‌شود.',
    loadFailed: 'خواندن رخدادها ممکن نشد',
  },
  section: {
    config: 'ارائه‌دهنده',
    fallback: 'جایگزین',
    usage: 'مصرف',
    budgets: 'بودجه',
    prompts: 'دستور',
    audit: 'گزارش',
  },
}

const af = {
  usage: {
    title: 'مصرف توکن و هزینه',
    description:
      'پرسش، توکن و هزینه به تفکیک روز، از پاسخ ارائه‌دهنده و قیمت‌هایی که خودتان وارد کرده‌اید.',
    day: 'روز',
    provider: 'ارائه‌دهنده',
    model: 'مدل',
    queries: 'پرسش',
    promptTokens: 'توکن پرسش',
    completionTokens: 'توکن پاسخ',
    cost: 'هزینه',
    unpriced: 'بدون قیمت',
    unpricedHint: 'هزینهٔ «—» یعنی هیچ قیمتی برای آن مدل ثبت نشده؛ هزینه ناشناخته است، نه صفر.',
    empty: 'در این بازه پرسشی ثبت نشده',
    emptyHint: 'بعد از پاسخ دستیار، مصرف اینجا نمایش داده می‌شود.',
    loadFailed: 'خواندن مصرف ممکن نشد',
    range: { '24h': '۲۴ ساعت', '7d': '۷ روز', '30d': '۳۰ روز', '90d': '۹۰ روز' },
  },
  price: {
    title: 'قیمت مدل‌ها',
    description:
      'هزینه‌ای که به‌ازای هر میلیون توکن می‌پردازید؛ دستی وارد می‌شود و هیچ قیمتی حدس زده نمی‌شود.',
    currency: 'ارز',
    input: 'ورودی / میلیون',
    output: 'خروجی / میلیون',
    actions: 'عملیات',
    add: 'افزودن قیمت',
    empty: 'هنوز قیمتی ثبت نشده',
    emptyHint: 'تا وقتی قیمتی برای مدل ثبت نشود، هزینهٔ آن ناشناخته می‌ماند.',
    hint: 'مبلغ به واحد خودِ ارز است (مثلاً ۳٫۰۰ دالر برای هر میلیون توکن)، نه به واحد خرد.',
    confirmTitle: 'این قیمت ذخیره شود؟',
    confirmDesc: 'قیمت از این پس اعمال می‌شود و هزینه‌های گذشته را بازنویسی نمی‌کند.',
    deleteTitle: 'این قیمت حذف شود؟',
    deleteDesc: 'هزینهٔ پرسش‌های قبلی حفظ می‌شود؛ پرسش‌های بعدی بدون قیمت می‌مانند.',
  },
  fallback: {
    title: 'زنجیرهٔ جایگزین',
    description:
      'فقط وقتی ارائه‌دهندهٔ اصلی خطا بدهد (پایان مهلت، ۴۲۹، ۵xx) به ترتیب امتحان می‌شود؛ هرگز وقتی درخواست را رد کند.',
    position: 'تلاش {position}',
    timeout: 'مهلت (میلی‌ثانیه)',
    enabled: 'فعال',
    add: 'افزودن جایگزین',
    remove: 'حذف',
    empty: 'جایگزینی تنظیم نشده',
    emptyHint:
      'اگر ارائه‌دهندهٔ اصلی از کار بیفتد، پرسش‌ها شکست می‌خورند. جایگزین دستیار را پاسخ‌گو نگه می‌دارد.',
    loadFailed: 'خواندن فهرست جایگزین ممکن نشد',
    confirmTitle: 'زنجیرهٔ جایگزین ذخیره شود؟',
    confirmDesc: '{count} مورد ذخیره می‌شود؛ هر مورد باید نام مدل داشته باشد.',
  },
  budgets: {
    title: 'بودجهٔ مصرف',
    description: 'سقفی برای هر ارز؛ بودجه یک محدودیت است، نه برآورد.',
    scope: 'دامنه',
    scopeName: { platform: 'پلتفرم', workspace: 'فضای کاری' },
    currency: 'ارز',
    limit: 'سقف ماهانه',
    spent: 'هزینهٔ این ماه',
    percent: 'درصد مصرف',
    alertPercent: 'هشدار در',
    actions: 'عملیات',
    add: 'ذخیرهٔ بودجه',
    empty: 'بودجه‌ای تعیین نشده',
    emptyHint: 'بدون بودجه چیزی جلوی هزینه را نمی‌گیرد؛ فقط بعداً آن را می‌بینید.',
    hint: 'به واحد خودِ ارز وارد می‌شود و به‌صورت عدد صحیح واحد خرد ذخیره می‌گردد.',
    loadFailed: 'خواندن بودجه‌ها ممکن نشد',
    confirmTitle: 'این بودجه ذخیره شود؟',
    confirmDesc: 'وقتی مصرف از درصد تعیین‌شده بگذرد، هشدار ماهی یک بار فرستاده می‌شود.',
    deleteTitle: 'این بودجه حذف شود؟',
    deleteDesc: 'سقف برداشته می‌شود؛ ثبت هزینه ادامه دارد.',
  },
  prompts: {
    title: 'نسخه‌های دستور',
    description:
      'هر دستور سیستمی که ذخیره شده، فقط افزودنی. «استفاده» فرم بالا را پر می‌کند و ذخیره، نسخهٔ تازه می‌سازد.',
    version: 'نسخه',
    createdAt: 'زمان ذخیره',
    createdBy: 'توسط',
    content: 'متن',
    actions: 'عملیات',
    use: 'استفاده',
    empty: 'هنوز نسخه‌ای ذخیره نشده',
    emptyHint: 'نخستین ذخیرهٔ دستور سیستمی، نسخهٔ ۱ را می‌سازد.',
    loadFailed: 'خواندن نسخه‌های دستور ممکن نشد',
  },
  audit: {
    title: 'گزارش رخدادهای هوش مصنوعی',
    description: 'تغییر تنظیمات و کلید، و شمار پرسش‌ها. متن پرسش و پاسخ نمایش داده نمی‌شود.',
    event: 'رخداد',
    actor: 'توسط',
    at: 'زمان',
    details: 'جزئیات',
    empty: 'هنوز رخدادی ثبت نشده',
    emptyHint: 'ذخیرهٔ تنظیمات یا آزمایش اتصال اینجا دیده می‌شود.',
    loadFailed: 'خواندن رخدادها ممکن نشد',
  },
  section: {
    config: 'ارائه‌دهنده',
    fallback: 'جایگزین',
    usage: 'مصرف',
    budgets: 'بودجه',
    prompts: 'دستور',
    audit: 'گزارش',
  },
}

const additions = { en, fa, af }

/**
 * Insert `extra` into the `"ai": { … }` object of `admin`, before its closing
 * brace. Brace matching is string-aware so a `}` inside a message never ends
 * the object early.
 */
function insertIntoAiObject(text, extra) {
  const anchor = '\n    "ai": {\n'
  const start = text.indexOf(anchor)
  if (start === -1) throw new Error('admin.ai object not found')
  const openBrace = text.indexOf('{', start)
  let depth = 0
  let inString = false
  let escaped = false
  let close = -1
  for (let i = openBrace; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close === -1) throw new Error('unterminated admin.ai object')

  // JSON.stringify gives 2-space indentation; the bundle nests keys at 6.
  const rendered = JSON.stringify(extra, null, 2)
    .split('\n')
    .slice(1, -1)
    .map((line) => `    ${line}`)
    .join('\n')

  const before = text.slice(0, close).replace(/\s+$/, '')
  const after = text.slice(close)
  return `${before},\n${rendered}\n    ${after}`
}

let changed = 0
for (const locale of ['en', 'fa', 'af']) {
  const path = `${root}/packages/i18n/messages/${locale}/common.json`
  const before = readFileSync(path, 'utf8')
  const after = insertIntoAiObject(before, additions[locale])
  // Must still be valid JSON, and every new leaf must resolve.
  const parsed = JSON.parse(after)
  const check = (obj, prefix) => {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') check(value, `${prefix}.${key}`)
      else if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${locale}: empty ${prefix}.${key}`)
      }
    }
  }
  check(additions[locale], 'admin.ai')
  if (!parsed.admin || !parsed.admin.ai) throw new Error(`${locale}: admin.ai lost`)
  writeFileSync(path, after)
  changed += 1
  console.log(`updated ${locale}`)
}
console.log(`files changed: ${changed}`)
