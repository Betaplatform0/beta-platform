import { auth, db, doc, getDoc, onAuthStateChanged, signOut } from "./firebase-config.js";

/**
 * requiredRoles: ["owner","admin"] أو ["student"] أو null للسماح للجميع
 * تُعيد Promise تحتوي بيانات المستخدم بعد التأكد من الجلسة والصلاحية
 */
export function guardPage(requiredRoles) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        await signOut(auth);
        window.location.href = "index.html";
        return;
      }
      const data = snap.data();

      if (data.status !== "active") {
        await signOut(auth);
        window.location.href = "index.html";
        return;
      }

      if (requiredRoles && !requiredRoles.includes(data.role)) {
        // مستخدم مسجل دخول لكن يحاول الوصول لصفحة لا تخصه
        window.location.href = data.role === "student" ? "student.html" : "dashboard.html";
        return;
      }

      resolve({ uid: user.uid, idToken: await user.getIdToken(), ...data });
    });
  });
}

export async function logout() {
  await signOut(auth);
  window.location.href = "index.html";
}

window.betaLogout = logout;
