// =====================================================
// إعدادات Firebase - Beta Platform
// ضع بيانات مشروعك من Firebase Console > Project Settings
// =====================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "PUT_YOUR_API_KEY_HERE",
  authDomain: "PUT_YOUR_PROJECT.firebaseapp.com",
  projectId: "PUT_YOUR_PROJECT_ID",
  storageBucket: "PUT_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PUT_SENDER_ID",
  appId: "PUT_APP_ID",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
};

// عنوان الـ Backend الخاص برفع/حماية الملفات (Node/Express) - غيّره بعد النشر
export const BACKEND_URL = "https://your-backend-domain.com";

// -----------------------------------------------------------------
// Firebase Auth لا يدعم تسجيل الدخول برقم الهاتف + كلمة سر مباشرة،
// لذلك نحوّل رقم الهاتف إلى "بريد وهمي" ثابت الصيغة يُستخدم داخليًا فقط
// -----------------------------------------------------------------
export function phoneToPseudoEmail(phone) {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  return `${cleanPhone}@beta-platform.local`;
}
