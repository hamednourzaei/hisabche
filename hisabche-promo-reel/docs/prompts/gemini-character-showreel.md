# پرامپت Gemini — ویدیوی ۴۰ ثانیه‌ای «یک شخصیت از حسابچه می‌گوید»

## نحوه‌ی استفاده

Gemini (Veo) هر بار یک کلیپ حدود **۸ ثانیه‌ای** می‌سازد. پس این ویدیو پنج شات ۸ ثانیه‌ای است = ۴۰ ثانیه.

1. اول بلوک «شخصیت و سبک» را بفرستید، بعد شات ۱ را. برای هر شات بعدی، **دوباره** بلوک «شخصیت و سبک» + متن همان شات را بفرستید تا چهره و لباس عوض نشود.
2. اگر Gemini گزینه‌ی «ادامه‌ی کلیپ» (extend) دارد، شات‌های ۲ تا ۵ را با آن بسازید.
3. صدا: اگر Gemini گفتار فارسی را خوب نخواند، کلیپ‌ها را **بی‌گفتار** بسازید و متن گوینده را با ElevenLabs بسازید (مثل قبل، هر شات یک فایل).
4. متن روی صفحه را از Gemini نخواهید؛ نوشته‌ی فارسی در ویدیوی ساخته‌شده معمولاً خراب درمی‌آید. زیرنویس را بعداً اضافه می‌کنیم.

---

## شخصیت و سبک (اول هر درخواست بچسبانید)

```
Character: a friendly shop owner in his mid-30s, short dark beard, warm smile,
dark green apron over a light grey shirt, standing behind the wooden counter of a
small, tidy grocery and household-goods shop in Kabul or Tehran. Shelves of cooking
oil, rice sacks and boxed goods behind him. He holds a smartphone and sometimes a
tablet. Same face, same clothes, same shop in every shot.

Style: premium motion-graphics ad, 9:16 vertical, cinematic shallow depth of field,
warm afternoon light through the shop window, smooth camera moves (slow push-in,
gentle orbit, whip-pan transitions). Clean flat-design UI panels float around him
as animated glass cards in emerald green and soft gold, with numbers and icons only —
NO readable text, NO letters, NO logos on screen. Physical motion: cards snap into
place with a soft spring, receipts slide, a small spark when something is saved.
He speaks directly to the camera, relaxed and confident, like explaining to a friend.
No other brands, no real company logos.
```

---

## شات ۱ — قلاب (۰ تا ۸ ثانیه)

```
Shot 1 (8 s): Close-up on the shop owner leaning on the counter, a pile of paper
receipts and a thick notebook in front of him, slightly overwhelmed. He looks up at
the camera and smiles. On "حسابچه" the paper pile lifts off the counter, swirls, and
reforms into one glowing green glass card that floats above his phone.
Camera: slow push-in, then a quick tilt up following the card.
He says (Persian): «فروشت زیاده، ولی آخر روز نمی‌دونی سودت چقدر شد؟ با حسابچه بدون.»
```

## شات ۲ — یک فاکتور، چند کار خودکار (۸ تا ۱۶ ثانیه)

```
Shot 2 (8 s): He taps his phone once. A single invoice card flies out of the phone
and splits into four smaller cards that fly to four places around him: one to the
shelf behind him (stock box icon, a number counting down), one to a cash drawer
(coin icon), one to a customer card (person icon with a balance), one to a ledger
book icon. Each lands with a soft spring and a tiny spark.
Camera: gentle 180° orbit around him following the cards.
He says (Persian): «یه فاکتور می‌زنی؛ موجودی انبار، صندوق، حساب مشتری و دفتر خودش به‌روز می‌شه.»
```

## شات ۳ — طلب و نسیه (۱۶ تا ۲۴ ثانیه)

```
Shot 3 (8 s): A customer card floats beside him; he swipes it and it opens into a
clean timeline of small invoice and payment chips, with a running balance bar that
fills up, then drains as payment chips drop in. He nods, satisfied.
Camera: whip-pan from the shelf to the customer card, then slow drift.
He says (Persian): «نسیه‌ی هر مشتری با یه نگاه: چی برده، چی داده، چقدر مونده.»
```

## شات ۴ — اینترنت قطع شد (۲۴ تا ۳۲ ثانیه)

```
Shot 4 (8 s): The shop lights flicker, a Wi-Fi icon above his phone turns grey and
breaks. He keeps selling calmly — invoice cards keep stacking in a small queue next
to the phone. The Wi-Fi icon turns green again and the stacked cards stream upward
into a cloud icon in one smooth wave.
Camera: locked-off medium shot, then a slow pull-back revealing the whole counter.
He says (Persian): «اینترنت قطع شد؟ فروش وانمی‌سته؛ وصل که شد، خودش هماهنگ می‌کنه.»
```

## شات ۵ — دعوت پایانی (۳۲ تا ۴۰ ثانیه)

```
Shot 5 (8 s): All the cards from the previous shots fly back and settle into one
calm, organized dashboard panel floating in front of him (a few small charts and
numbers, no text). He steps out from behind the counter, smiles and points at the
camera. Final 3 seconds: the panel glows softly and holds still — leave clean empty
space in the lower third for a title card.
Camera: slow pull-back to a medium-wide shot, then hold.
He says (Persian): «حساب مغازه‌ات رو دست حسابچه بده؛ شروع رایگانه.»
```

---

## پیش از انتشار — بررسی کنید

- **هر جمله باید در حسابچه واقعاً وجود داشته باشد.** چهار ادعای بالا (یک فاکتور ← موجودی/صندوق/مشتری/دفتر؛ مانده‌ی هر مشتری؛ کار آفلاین و هماهنگی بعدی؛ شروع رایگان) در خود محصول هست. چیز تازه‌ای که Gemini اضافه کرد (پیامک، اتصال بانک، «۱۰۰٪»، «تضمین»، مودیان، ضدجعل) را **حذف** کنید.
- متن یا لوگوی ساختگی روی صفحه = کلیپ را دوباره بسازید.
- چهره یا لباس در شاتی عوض شد = همان شات را با بلوک «شخصیت و سبک» دوباره بسازید.
- زیرنویس فارسی و کارت پایانی (لوگو + hisabche.com) را خودمان روی ویدیو می‌گذاریم، نه Gemini.
- قبل از انتشار، شرایط استفاده‌ی تجاری Gemini/Veo و ElevenLabs را بررسی کنید.
