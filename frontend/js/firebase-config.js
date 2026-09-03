// =====================================================
// إعدادات Firebase - Beta Platform
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
  apiKey: "AIzaSyBzLDq9PqC5iYLD-mMlpLylkRBhDh5SuEU",
  authDomain: "beta-platform-d3f84.firebaseapp.com",
  projectId: "beta-platform-d3f84",
  storageBucket: "beta-platform-d3f84.firebasestorage.app",
  messagingSenderId: "833275620854",
  appId: "1:833275620854:web:e8d4149d4a09fcbee7ebd7",
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
