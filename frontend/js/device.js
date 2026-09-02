// =====================================================
// إدارة معرّف الجهاز (Device Binding) من جهة العميل
// =====================================================
// ملاحظة أمانة: أي قيمة يولّدها المتصفح يمكن نظريًا مسحها من قبل
// المستخدم المتقدّم (مسح localStorage). لذلك الحماية الحقيقية تتم
// من خلال الـ Backend: بعد كل تسجيل دخول، الـ Backend يقارن هذا
// المعرف مع القيمة المخزّنة في Firestore، وإن كان مختلفًا يرفض
// الجلسة فورًا (انظر backend/routes/device.js).
// هذا هو أقصى مستوى ممكن تحقيقه بدون تطبيق جوال أصلي (Native App).

const STORAGE_KEY = "beta_device_id";

function generateDeviceId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateDeviceId() {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateDeviceId();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function getDeviceFingerprint() {
  // بصمة إضافية بسيطة (وليست الاعتماد الوحيد) لتعقيد عملية الالتفاف
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const lang = navigator.language || "";
  return btoa(unescape(encodeURIComponent(`${ua}|${platform}|${lang}`))).slice(0, 64);
}
