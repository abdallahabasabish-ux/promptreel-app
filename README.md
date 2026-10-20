# PromptReel — Static Edition (HTML5 + CSS + JavaScript)

يعمل التطبيق بالكامل داخل المتصفح: لا PHP، لا خوادم، لا قواعد بيانات.
المستخدم يُدخل مفتاح Gemini API الخاص به في الإعدادات (يُحفظ في متصفحه فقط)،
وينطلق مباشرة من المتصفح إلى Google.

The entire app is a static site: pure HTML5, CSS and vanilla JavaScript.
No PHP, no backend, no database. The user brings their own Gemini API key
(stored only in their browser) and calls Google directly.

## التشغيل محليًا / Run locally

الطريقة الأسهل: افتح `index.html` في المتصفح (نقرة مزدوجة).
إن لم يعمل النسخ أو طلب المفاتيح بسبب قيود `file://`، شغّل خادمًا محليًا:

Easiest: double-click `index.html`. If the browser blocks anything due to
`file://` restrictions, serve the folder instead:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## الحصول على مفتاح Gemini / Get a Gemini API key

1. افتح https://aistudio.google.com/apikey
2. أنشئ مفتاحًا مجانيًا (AIza…)
3. الصقه في: الإعدادات ← مفتاح Gemini API ← حفظ، ثم اضغط «فحص المفتاح».

## النشر / Deploy

- **Hostinger**: ارفع محتويات هذا المجلد إلى `public_html`. ملف `.htaccess`
  مرفق (ترويسات أمان + تخزين مؤقت للأصول).
- **GitHub Pages** (مجاني بالكامل): ارفع المجلد إلى مستودع وفعّل Pages من
  الفرع الرئيسي.
- أي استضافة ثابتة أخرى تعمل مباشرة.

## البنية / Structure

```
index.html            SPA shell (hash router)
css/                  base / components / views / rtl
js/
  i18n.js             trilingual engine (AR/EN/FR + RTL)
  lang/*.js           dictionaries
  store.js            localStorage (settings + projects)
  ui.js               toasts, modal, clipboard, icons
  video.js            container signature sniffing (ftyp/EBML), duration, thumb
  gemini.js           inline + resumable Files API, structured 8-scene output
  scenes.js           the 8-scene contract: validate / normalize / export
  views/              landing, studio, result, projects, settings
  main.js             router + chrome
assets/favicon.svg    brand mark
```

## عقد المشاهد الثمانية / The 8-scene contract

كل قصة مولَّدة يجب أن تحترم: ٨ مشاهد متسلسلة بالضبط، مدد بين ٤–١٢ ثانية
ومجموعها قريب من ٦٠ ثانية، `image_prompt` و`video_prompt` بالإنجليزية،
و`spoken_dialogue` بلغة الحوار المختارة. أي خرق يُصلَّح تلقائيًا بجولة
تصحيح واحدة قبل العرض.

Every generated story must respect: exactly 8 consecutive scenes, durations
4–12s each summing to ~60s, English image/video prompts, and dialogue in the
chosen language. Violations trigger one automatic repair round before display.

## الخصوصية / Privacy

لا حسابات، لا تتبع، لا خوادم. المفتاح والقصص يبقيان في `localStorage`
للمتصفح. اتصالات الذكاء الاصطناعي تذهب مباشرة إلى
`generativelanguage.googleapis.com`.

No accounts, no tracking, no servers. The key and stories live in the
browser's `localStorage`; AI calls go straight to Google's API endpoint.
