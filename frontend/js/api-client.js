import { auth, BACKEND_URL } from "./firebase-config.js";

// دالة موحّدة لمنع XSS - تحوّل أي نص لصيغة آمنة قبل إدراجه في HTML
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// عميل API موحّد - بيجيب توكن حديث في كل طلب بدل توكن مخزّن قديم
export async function api(pathname, options = {}) {
  const user = auth.currentUser;
  if (!user) {
    window.location.replace("index.html");
    throw new Error("انتهت الجلسة، سجّل دخولك تاني.");
  }

  const token = await user.getIdToken();
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${BACKEND_URL}${pathname}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.replace("index.html");
    throw new Error("انتهت الجلسة، سجّل دخولك تاني.");
  }

  if (!response.ok) {
    throw new Error(data.message || "حدث خطأ");
  }

  return data;
}
