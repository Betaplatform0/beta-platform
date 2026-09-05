import { auth, db, doc, getDoc, onAuthStateChanged, signOut } from "./firebase-config.js";

export function guardPage(requiredRoles) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.replace("index.html");
        return;
      }
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        await signOut(auth);
        window.location.replace("index.html");
        return;
      }
      const data = snap.data();

      if (data.status !== "active") {
        await signOut(auth);
        window.location.replace("index.html");
        return;
      }

      if (requiredRoles && !requiredRoles.includes(data.role)) {
        window.location.replace(data.role === "student" ? "student.html" : "dashboard.html");
        return;
      }

      resolve({ uid: user.uid, idToken: await user.getIdToken(), ...data });
    });
  });
}

export async function logout() {
  await signOut(auth);
  window.location.replace("index.html");
}

// إعادة التحقق من الجلسة لو المستخدم رجع للصفحة بزرار الرجوع
// (بعض المتصفحات بتوري نسخة محفوظة "bfcache" من غير ما تعيد تحميل الصفحة فعليًا)
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    if (!auth.currentUser) {
      window.location.replace("index.html");
    }
  }
});

window.betaLogout = logout;
