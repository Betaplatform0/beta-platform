const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

const db = () => admin.firestore();

/**
 * POST /api/auth/register-profile
 * يُستدعى مباشرة بعد createUserWithEmailAndPassword في الفرونت إند.
 * هذا هو المكان الوحيد الذي يُقرَّر فيه إن كان المستخدم Owner أم Student،
 * ويتم بشكل ذرّي (Transaction) لمنع تسجيل أكثر من Owner واحد حتى مع
 * محاولات تسجيل متزامنة.
 */
router.post("/register-profile", async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "غير مصرح." });

    const decoded = await admin.auth().verifyIdToken(token, true);
    const { fullName, phone, seatNumber } = req.body;

    if (!fullName || !phone || !seatNumber) {
      return res.status(400).json({ message: "جميع الحقول مطلوبة." });
    }

    const userRef = db().collection("users").doc(decoded.uid);
    const existing = await userRef.get();
    if (existing.exists) {
      return res.status(400).json({ message: "الملف الشخصي موجود بالفعل." });
    }

    // معاملة ذرّية: نتحقق من عداد المستخدمين داخل counters/users
    // (أسرع وأضمن من عدّ كل المستندات في users في كل مرة)
    const counterRef = db().collection("counters").doc("users");

    const role = await db().runTransaction(async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const currentCount = counterSnap.exists ? counterSnap.data().count || 0 : 0;
      const isFirstUser = currentCount === 0;

      tx.set(counterRef, { count: currentCount + 1 }, { merge: true });

      tx.set(userRef, {
        fullName,
        phone,
        seatNumber,
        role: isFirstUser ? "owner" : "student",
        status: isFirstUser ? "active" : "pending",
        deviceId: null,
        deviceFingerprint: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: null,
      });

      return isFirstUser ? "owner" : "student";
    });

    return res.json({ role });
  } catch (err) {
    console.error("register-profile error:", err);
    return res.status(500).json({ message: "حدث خطأ أثناء إنشاء الملف الشخصي." });
  }
});

module.exports = router;
