# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: business-day.spec.ts >> a working day: the shell, the lists, the ledger and the data hub all render
- Location: e2e\business-day.spec.ts:79:5

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=f12e1]:
    - generic [ref=f12e2]:
        - complementary "منوی اصلی" [ref=f12e3]:
            - generic [ref=f12e4]:
                - img "حسابچه" [ref=f12e6]
                - generic [ref=f12e7]: حسابچه
            - navigation [ref=f12e9]:
                - button "امروز" [ref=f12e10] [cursor=pointer]
                - button "دریافت پول" [ref=f12e18] [cursor=pointer]
                - button "موجودی" [ref=f12e25] [cursor=pointer]
                - button "پول و سود" [ref=f12e38] [cursor=pointer]
                - button "صندوق" [ref=f12e44] [cursor=pointer]
            - generic [ref=f12e50]:
                - button "بیشتر" [expanded] [ref=f12e51] [cursor=pointer]
                - generic [ref=f12e60]:
                    - generic [ref=f12e61]:
                        - generic [ref=f12e62]: مردم
                        - generic [ref=f12e65]:
                            - button "طرف حساب‌ها" [ref=f12e66] [cursor=pointer]
                            - button "پیگیری فروش" [ref=f12e70] [cursor=pointer]
                            - button "تیم و حقوق" [ref=f12e77] [cursor=pointer]
                            - button "همکاران" [ref=f12e84] [cursor=pointer]
                            - button "پیگیری فروش" [ref=f12e89] [cursor=pointer]
                    - generic [ref=f12e96]:
                        - generic [ref=f12e97]: کارها
                        - generic [ref=f12e100]:
                            - button "در انتظار تأیید شما" [ref=f12e101] [cursor=pointer]
                            - button "انقضا" [ref=f12e107] [cursor=pointer]
                            - button "بودجه" [ref=f12e112] [cursor=pointer]
                            - button "کارکرد" [ref=f12e118] [cursor=pointer]
                            - button "دارایی ثابت" [ref=f12e123] [cursor=pointer]
                            - button "مغایرت بانکی" [ref=f12e129] [cursor=pointer]
                            - button "فهرست مشتریان" [ref=f12e133] [cursor=pointer]
                            - button "فهرست کالاها" [ref=f12e140] [cursor=pointer]
                            - button "حسابداری" [ref=f12e152] [cursor=pointer]
                            - button "فروش" [ref=f12e156] [cursor=pointer]
                            - button "انبار" [ref=f12e161] [cursor=pointer]
                            - button "کارکنان" [ref=f12e173] [cursor=pointer]
                            - button "ساخت و تولید" [ref=f12e180] [cursor=pointer]
                            - button "خرید" [ref=f12e184] [cursor=pointer]
                            - button "قالب‌های گردش کار" [ref=f12e190] [cursor=pointer]
                    - generic [ref=f12e197]:
                        - generic [ref=f12e198]: سیستم
                        - generic [ref=f12e201]:
                            - button "تنظیمات" [ref=f12e202] [cursor=pointer]
                            - button "دسترسی‌ها" [ref=f12e208] [cursor=pointer]
                            - button "رخدادها" [ref=f12e214] [cursor=pointer]
                            - button "همگام‌سازی" [ref=f12e219] [cursor=pointer]
                            - button "تعارض‌های آفلاین" [ref=f12e226] [cursor=pointer]
                            - button "داده و همگام‌سازی" [ref=f12e232] [cursor=pointer]
                            - button "انتقال داده" [ref=f12e239] [cursor=pointer]
                            - button "پلن و اشتراک" [ref=f12e246] [cursor=pointer]
                            - button "تفکیک وظایف" [ref=f12e250] [cursor=pointer]
            - paragraph [ref=f12e258]: v3.0
        - generic [ref=f12e259]:
            - banner [ref=f12e260]:
                - generic [ref=f12e261]:
                    - generic [ref=f12e262]:
                        - img "حسابچه" [ref=f12e263]
                        - generic [ref=f12e264]: حسابچه
                        - generic [ref=f12e267]: همین الان
                    - generic [ref=f12e269]:
                        - searchbox "جستجو در مشتریان، محصولات، فاکتورها..." [ref=f12e272]
                        - button "تغییر زبان" [ref=f12e274] [cursor=pointer]:
                            - generic [ref=f12e275]: 🇮🇷
                            - generic [ref=f12e276]: فارسی
                        - button "حالت تاریک" [ref=f12e279] [cursor=pointer]:
                            - img [ref=f12e280]: M13.2 9.4A5.4 5.4 0 0 1 6.6 2.8a5.4 5.4 0 1 0 6.6 6.6Z
                        - button "اعلان‌ها" [ref=f12e282] [cursor=pointer]
                        - button "خروج" [ref=f12e286] [cursor=pointer]
            - main [ref=f12e292]:
                - navigation "Breadcrumb" [ref=f12e293]:
                    - link "امروز" [ref=f12e294] [cursor=pointer]:
                        - /url: /fa/dashboard
                    - generic [ref=f12e299]: دریافت پول
                - main [ref=f12e303]:
                    - generic [ref=f12e304]:
                        - generic [ref=f12e305]:
                            - generic [ref=f12e306]:
                                - heading "دریافت پول" [level=1] [ref=f12e307]
                                - paragraph [ref=f12e308]: چه کسی چقدر باید بپردازد
                            - button "صورت‌حساب جدید" [ref=f12e309] [cursor=pointer]
                        - generic [ref=f12e312]:
                            - radiogroup "نوع" [ref=f12e313]:
                                - radio "همه" [checked] [ref=f12e314] [cursor=pointer]
                                - radio "فروش" [ref=f12e315] [cursor=pointer]
                                - radio "خرید" [ref=f12e316] [cursor=pointer]
                            - button "خروجی" [disabled] [ref=f12e317]
                        - generic [ref=f12e321]:
                            - generic [ref=f12e322]:
                                - button "جستجو" [ref=f12e323] [cursor=pointer]
                                - button "تنظیمات جدول" [ref=f12e328] [cursor=pointer]
                            - status [ref=f12e332]:
                                - heading "هیچ فاکتوری یافت نشد" [level=3] [ref=f12e337]
                                - paragraph [ref=f12e338]: هنوز هیچ فاکتوری ثبت نشده است.
                                - button "صورت‌حساب جدید" [ref=f12e339] [cursor=pointer]
    - generic "Notifications"
    - button "Open Next.js Dev Tools" [ref=f12e345] [cursor=pointer]
```
