معماری‌ای که نوشتی از نظر جهت‌گیری خیلی خوب است، ولی اگر بخواهم برای **Hisabche** که Offline-First، Fastify، Supabase، WatermelonDB و هدف **۵۰ هزار کاربر همزمان** دارد معماری Enterprise طراحی کنم، چند بخش مهم باید تغییر کند.

مهم‌ترین نکته:

> **Fastify نباید هر دقیقه به جای کاربران از Supabase Poll کند.**

این معماری در مقیاس بزرگ خودش تبدیل به گلوگاه می‌شود.

---

# معماری نهایی Hisabche Enterprise v2

```
                    ┌────────────────────┐
                    │      Client        │
                    │ React / RN / PWA   │
                    └─────────┬──────────┘
                              │
               WebSocket / SSE / HTTPS
                              │
                              ▼
                ┌─────────────────────────┐
                │ Fastify API Gateway     │
                │                         │
                │ Auth                    │
                │ REST                    │
                │ WebSocket Hub           │
                │ Sync Engine             │
                │ Polling Engine          │
                └─────────┬───────────────┘
                          │
              Redis Pub/Sub + Cache
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
  Gateway #1        Gateway #2        Gateway #3
        │                 │                 │
        └────────────┬────┴─────────────────┘
                     │
             Few Shared Connections
                     │
                     ▼
             Supabase Realtime
                     │
         postgres_changes / Broadcast
                     │
                     ▼
               PostgreSQL Database
```

---

# اصل شماره یک

به جای

```
50000 Client
↓

50000 Realtime Connection
↓

Supabase
```

باید تبدیل شود به

```
50000 Client

↓

10 Fastify Nodes

↓

30 Realtime Connections

↓

Supabase
```

یعنی

هر Node فقط چند Connection دارد.

---

# پیشنهاد اول (Realtime Multiplexing)

الان هر Browser خودش Realtime باز می‌کند.

این بدترین حالت است.

در معماری جدید

```
Gateway

↓

3 websocket

↓

Supabase
```

ولی

```
Gateway

↓

20000 websocket

↓

Clients
```

یعنی Gateway رویدادها را Broadcast می‌کند.

---

# پیشنهاد دوم (Workspace Subscription)

به جای

```
Invoices
```

مشترک شوید روی

```
workspace:123

workspace:456

workspace:789
```

نه جدول.

مثلاً

```
workspace:35

↓

Invoices
Products
Customers
Notifications
```

همه روی یک کانال.

---

# پیشنهاد سوم (Adaptive Realtime)

سه حالت

```
Realtime

↓

SSE

↓

Polling
```

اگر Realtime شکست خورد

```
3 retry

↓

Switch

↓

SSE
```

اگر SSE هم شکست خورد

```
Polling
```

---

# پیشنهاد چهارم (Smart Polling)

Polling ثابت ممنوع.

اشتباه:

```
هر 10 ثانیه
```

درست:

```
Active Screen

↓

5 sec

---------

Background

↓

30 sec

---------

Hidden Tab

↓

120 sec
```

---

# پیشنهاد پنجم (Event Aggregator)

اگر ده رویداد پشت سر هم آمد

الان

```
10 websocket message
```

بهتر است

```
1 batch

[
update1,
update2,
update3
]
```

---

# پیشنهاد ششم (Delta Sync)

هیچوقت

```
GET /invoices
```

نداشته باش.

همیشه

```
GET

/sync

?after=timestamp
```

یا

```
version
```

---

# پیشنهاد هفتم (Redis Cache Layer)

```
Client

↓

Gateway

↓

Redis

↓

Supabase
```

مثلاً

```
Invoice

↓

Redis

↓

30 sec
```

---

# پیشنهاد هشتم (Request Coalescing)

اگر

1000 کاربر

همزمان

```
Invoice 235
```

را بخواهند

نباید

1000 Query

برود.

باید

```
1000 Request

↓

Gateway

↓

1 Query

↓

Redis

↓

1000 Response
```

---

# پیشنهاد نهم (Sync Queue)

```
Offline

↓

Watermelon

↓

Queue

↓

Gateway

↓

Batch

↓

Supabase
```

نه

```
100 Request
```

بلکه

```
1 Request

↓

100 Changes
```

---

# پیشنهاد دهم (Gateway Polling)

اینجا یک نکته مهم وجود دارد.

تو گفتی

> Gateway هر یک دقیقه Poll کند.

من پیشنهاد می‌کنم این را هوشمند کنیم.

```
Realtime Healthy

↓

Realtime

---------

Realtime Failed

↓

5 sec Poll

---------

Still Failed

↓

15 sec

---------

Still Failed

↓

30 sec

---------

Still Failed

↓

60 sec
```

یعنی Adaptive.

---

# پیشنهاد یازدهم (Circuit Breaker)

```
Realtime

↓

Failure

↓

Failure

↓

Failure

↓

OPEN
```

حالا

```
Polling
```

فعال می‌شود.

بعد

```
30 sec

↓

Half Open

↓

Retry

↓

Success

↓

Realtime
```

---

# پیشنهاد دوازدهم (Workspace Cache)

```
Redis

workspace:32

↓

Invoices

↓

Customers

↓

Products
```

به جای Cache تک جدول.

---

# پیشنهاد سیزدهم (Redis Pub/Sub)

اگر

۱۰ Gateway

داشته باشی

```
Gateway1

↓

Redis PubSub

↓

Gateway2

↓

Gateway3
```

همه همزمان پیام را دریافت می‌کنند.

---

# پیشنهاد چهاردهم (Compression)

فعال کن

```
permessage-deflate
```

---

# پیشنهاد پانزدهم (Binary Protocol)

به جای

JSON

از

```
MessagePack
```

استفاده کن.

حدود

۳۰ تا ۵۰٪

حجم کمتر می‌شود.

---

# پیشنهاد شانزدهم (Connection Manager)

هر کاربر

```
Socket

↓

Workspace

↓

Permissions

↓

Last Seen

↓

Presence
```

در Memory نگهداری شود.

---

# پیشنهاد هفدهم (Presence Service)

Presence جدا از Notification باشد.

```
Realtime

↓

Presence

↓

Redis

↓

Gateway
```

---

# پیشنهاد هجدهم (Event Bus)

تمام تغییرات اول وارد Event Bus شوند.

```
Invoice Updated

↓

Bus

↓

Notification

↓

Realtime

↓

Audit

↓

Webhook
```

---

# پیشنهاد نوزدهم (Notification Queue)

اعلان‌ها مستقیم ارسال نشوند.

```
Redis Queue

↓

Worker

↓

Gateway

↓

Socket
```

---

# پیشنهاد بیستم (Monitoring)

حداقل این متریک‌ها:

* Gateway latency
* Redis latency
* Supabase latency
* Active sockets
* Polling clients
* Realtime failures
* Cache hit ratio
* Sync duration
* Queue depth
* Broadcast delay

---

# پیشنهادی که مهم‌تر از همه است (شماره ۲۱)

به‌جای اینکه Fastify مستقیماً به Supabase متصل باشد، یک **Realtime Manager** مستقل بساز.

```
                    Clients
                       │
                       ▼
                 Fastify Gateway
                  │         │
                  │         ▼
                  │   Redis Pub/Sub
                  │         │
                  ▼         ▼
             Realtime Manager
                  │
          Few Realtime Connections
                  │
                  ▼
              Supabase
                  │
                  ▼
             PostgreSQL
```

این سرویس فقط سه مسئولیت دارد:

* مدیریت اتصال‌های Realtime به Supabase.
* مدیریت Circuit Breaker و سوئیچ بین Realtime و Polling.
* Broadcast کردن رویدادها به همه Gatewayها از طریق Redis.

در این معماری، Gateway فقط روی API، احراز هویت، Sync و مدیریت WebSocket کاربران تمرکز می‌کند و منطق پیچیده Realtime در یک سرویس جدا قرار می‌گیرد. این جداسازی باعث می‌شود سیستم در مقیاس ده‌ها هزار کاربر همزمان ساده‌تر، پایدارتر و قابل توسعه‌تر باشد.

## جمع‌بندی

از بین ۴۱ پیشنهاد، معماری را با این موارد کامل می‌کنم:

* اضافه کردن **Realtime Manager** به‌عنوان سرویس مستقل.
* استفاده از **Connection Multiplexing** تا هر نود فقط چند اتصال به Supabase داشته باشد.
* **Adaptive Realtime** (Realtime → SSE → Polling).
* **Circuit Breaker** با بازیابی خودکار.
* **Smart Polling** بر اساس وضعیت کاربر و سلامت سرویس.
* **Delta Sync** و **Batch Sync** به‌جای Full Sync.
* **Redis Pub/Sub** برای هماهنگی بین Gatewayها.
* **Event Bus** و **Notification Queue** برای پردازش غیرهمزمان.
* **Request Coalescing** و **Workspace Cache** برای کاهش بار PostgreSQL.
* **Monitoring** کامل برای مشاهده وضعیت سیستم در لحظه.

با این تغییرات، معماری از یک Gateway ساده به یک معماری Enterprise نزدیک می‌شود که برای هدفی مانند Hisabche با ده‌ها هزار کاربر همزمان، مقیاس‌پذیرتر و قابل نگهداری‌تر است.
