# Beta — منصة تعليمية خاصة

مشروع كامل: Frontend (HTML/CSS/JS) + Backend (Node.js/Express) + Firebase (Auth + Firestore).
لا يعتمد على Firebase Storage — الملفات تُخزَّن وتُحمى عبر السيرفر الخاص بك.

## 1) إعداد مشروع Firebase

1. أنشئ مشروعًا جديدًا في [Firebase Console](https://console.firebase.google.com).
2. من **Authentication > Sign-in method** فعّل **Email/Password** (نستخدمه داخليًا لتمثيل رقم الهاتف).
3. من **Firestore Database** أنشئ قاعدة بيانات (وضع Production).
4. من **Project Settings > General**: انسخ بيانات `firebaseConfig` وضعها في:
   `frontend/js/firebase-config.js`
5. من **Project Settings > Service Accounts**: اضغط **Generate New Private Key**،
   وضع الملف الناتج باسم `serviceAccountKey.json` داخل مجلد `backend/` (لا يُرفع على GitHub، موجود في .gitignore).
6. انشر قواعد الأمان الموجودة في `firestore.rules` (عبر Firebase Console > Firestore > Rules، أو `firebase deploy --only firestore:rules` إن كنت تستخدم Firebase CLI).

## 2) تشغيل الـ Backend محليًا

```bash
cd backend
npm install
cp .env.example .env   # عدّل القيم حسب الحاجة
node server.js
```

السيرفر سيعمل افتراضيًا على `http://localhost:4000`.

## 3) تشغيل الـ Frontend محليًا

الفرونت إند ملفات ثابتة (Static)، يمكنك فتحها عبر أي سيرفر بسيط أثناء التطوير، مثلًا:

```bash
cd frontend
npx serve .
```

عدّل قيمة `BACKEND_URL` في `frontend/js/firebase-config.js` لتشير إلى عنوان الباك اند
(`http://localhost:4000` أثناء التطوير، ورابط الاستضافة الحقيقي بعد النشر).

## 4) أول حساب = Owner

أول شخص يُنشئ حسابًا عبر صفحة `signup.html` يصبح **Owner** تلقائيًا (يتم التحقق من ذلك
بشكل ذرّي وآمن من الباك اند عبر Firestore Transaction، وليس من الفرونت إند، بحيث لا يمكن
لأي شخص التحايل والحصول على صلاحية Owner). أنشئ حساب المالك أولًا قبل مشاركة رابط التسجيل مع الطلاب.

## 5) النشر (Deployment)

نظرًا لأن الملفات تُخزَّن على قرص السيرفر (وليس Firebase Storage)، يجب نشر الباك اند على
منصة توفر تخزينًا دائمًا (Persistent Disk)، وليس بيئة Serverless عديمة الحالة. خيارات مقترحة:

- **Render** أو **Railway**: أضف Persistent Disk وارفع مجلد `backend/`.
- **VPS** (مثل DigitalOcean / Hetzner) مع `pm2` لتشغيل السيرفر باستمرار.

للفرونت إند: يمكن نشره مجانًا على **Firebase Hosting**، أو **Netlify**، أو **Vercel**
(كملفات ثابتة، مع تعديل `BACKEND_URL` ليشير لرابط الباك اند بعد نشره).

خطوات مقترحة لرفع المشروع على GitHub:

```bash
git init
git add .
git commit -m "Beta platform - initial version"
git branch -M main
git remote add origin <رابط مستودعك على GitHub>
git push -u origin main
```

**تذكير مهم:** لا ترفع أبدًا `backend/serviceAccountKey.json` أو `backend/.env` على GitHub.

## 6) هيكل المشروع

```
beta-platform/
├── firestore.rules              # قواعد أمان Firestore
├── frontend/
│   ├── index.html                # تسجيل الدخول
│   ├── signup.html               # إنشاء حساب
│   ├── dashboard.html            # لوحة Owner/Admin
│   ├── student.html              # واجهة الطالب
│   ├── css/style.css
│   └── js/
│       ├── firebase-config.js
│       ├── auth-guard.js
│       ├── device.js
│       ├── dashboard.js
│       ├── student.js
│       └── pdf-viewer.js
└── backend/
    ├── server.js
    ├── package.json
    ├── middleware/auth.js
    └── routes/
        ├── auth.js       # تسجيل أول Owner + بروفايل المستخدم
        ├── device.js      # ربط/تحقق/إعادة تعيين الجهاز الواحد
        ├── upload.js      # رفع ملفات PDF (Owner فقط)
        ├── files.js       # بث الملفات بعد التحقق من الصلاحية
        └── admin.js       # الحسابات، الفولدرات، الصلاحيات، الإحصائيات
```

## 7) ملاحظات أمان صادقة يجب معرفتها

- **الجهاز الواحد**: يعتمد على معرّف يُولَّد ويُخزَّن في `localStorage` ويُتحقق منه من الباك
  اند عند كل دخول. مستخدم متقدم جدًا قد يمسح بيانات المتصفح ويحاول الالتفاف، لكن هذا هو
  أقصى مستوى ممكن تحقيقه بدون تطبيق جوال أصلي (Native App) بمعرّف جهاز حقيقي (IMEI/Android ID)
  — وهو غير متاح من متصفح الويب لأسباب خصوصية يفرضها النظام نفسه.
- **حماية الملفات من التصوير**: لا توجد تقنية ويب (ولا حتى تطبيقات حقيقية) تمنع تصوير
  الشاشة بنسبة 100%. الحماية المطبَّقة (منع النسخ/الطباعة/الزر اليمين + العلامة المائية +
  الصلاحيات + الجهاز الواحد) تُقلّل التسريب وتُسهّل تتبع مصدره، وهذا هو الهدف الواقعي منها.
- **جميع القرارات الحساسة** (من هو Owner، من يملك صلاحية رؤية ملف، من يستطيع الرفع) تُنفَّذ
  ويُتحقق منها من جهة الباك اند وFirestore Rules، وليس فقط من واجهة المستخدم — بحيث لا يمكن
 تجاوزها عبر أدوات المطوّر في المتصفح.


