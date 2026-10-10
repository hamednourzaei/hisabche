import os

sales_file = "docs/feature-audit/raw/sales-pos.md"
with open(sales_file, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the incorrect API evidence
content = content.replace(
    "API: supabase/postgrest for invoices, invoice_items",
    "API: Fastify REST endpoints in `backend/src/routes/invoice.routes.ts` (GET/POST/PATCH /api/invoices)"
)

# Also fix the Persian markdown layout issue if it's there
with open(sales_file, "w", encoding="utf-8") as f:
    f.write(content)
