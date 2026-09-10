import { auth, db, doc, getDoc, onAuthStateChanged, signOut } from "./firebase-config.js";

export function guardPage(requiredRoles) {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          window.location.replace("index.html");
          return;
        }

        const snap = await getDoc(doc(db, "users", user.uid));

        if (!snap.exists()) {
          unsubscribe();
          await signOut(auth);
          window.location.replace("index.html");
          return;
        }

        const data = snap.data();

        if (data.status !== "active") {
          unsubscribe();
          await signOut(auth);
          window.location.replace("index.html");
          return;
        }

        if (requiredRoles && !requiredRoles.includes(data.role)) {
          unsubscribe();
          window.location.replace(data.role === "student" ? "student.html" : "dashboard.html");
          return;
        }

        unsubscribe();
        resolve({ uid: user.uid, ...data });
      } catch (error) {
        console.error("خطأ في التحقق من الجلسة");
        unsubscribe();
        await signOut(auth).catch(() => {});
        window.location.replace("index.html");
      }
    });
  });
}

export async function logout() {
  await signOut(auth);
  window.location.replace("index.html");
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    if (!auth.currentUser) {
      window.location.replace("index.html");
    }
  }
});

window.betaLogout = logout;
