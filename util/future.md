RBAC 
## 🗺️ رودمپ RBAC — Hisabche v1.2

---

## 📊 فازهای RBAC

| # | فاز | توضیح |
|:--:|------|--------|
| ۱ | **Role Permissions Table** | جدول `role_permissions` — هر role چی می‌تونه بکنه |
| ۲ | **Permission Check Middleware** | `requirePermission('invoices:delete')` |
| ۳ | **Dashboard per Role** | Admin dashboard ≠ Member dashboard |
| ۴ | **Route Guards** | `/settings`, `/workspace` — فقط admin/owner |
| ۵ | **UI Permission Hooks** | `useCan('invoices:create')` — دکمه‌ها مخفی/نمایش |
| ۶ | **API Permission Checks** | Backend route guard — `requireRole('admin')` |

---

## 📋 جدول پیشنهادی

```sql
CREATE TABLE role_permissions (
  role TEXT NOT NULL,       -- 'owner', 'admin', 'member', 'viewer'
  resource TEXT NOT NULL,   -- 'invoices', 'products', 'customers', 'settings'
  action TEXT NOT NULL,     -- 'create', 'read', 'update', 'delete', 'manage'
  PRIMARY KEY (role, resource, action)
);
```

### Permission Sets:

| Resource | Owner | Admin | Member | Viewer |
|----------|:-----:|:-----:|:------:|:------:|
| invoices | CRUD | CRUD | CR | R |
| products | CRUD | CRUD | R | R |
| customers | CRUD | CRUD | CR | R |
| settings | ✅ | ✅ | ❌ | ❌ |
| workspace | ✅ | ✅ | ❌ | ❌ |
| reports | ✅ | ✅ | ❌ | ❌ |

---

## 🎯 اولویت

1. **API Permission Check** (فاز ۶) — امنیت backend
2. **UI Hooks** (فاز ۵) — دکمه‌های مخفی
3. **Dashboard per Role** (فاز ۳)
4. **Route Guards** (فاز ۴)

---

**کدوم فاز رو شروع کنیم؟** 🫡