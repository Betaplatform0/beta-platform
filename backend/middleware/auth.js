const admin = require("firebase-admin");

const db = () => admin.firestore();

/**
 * يتحقق من صحة Firebase ID Token المُرسل في هيدر Authorization
 * ويرفق بيانات المستخدم (uid + مستند Firestore) على req.betaUser
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "غير مصرح: لا يوجد رمز دخول." });
    }

    const decoded = await admin.auth().verifyIdToken(token, true);
    const userSnap = await db().collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "الحساب غير موجود." });
    }

    const userData = userSnap.data();

    if (userData.status === "disabled") {
      return res.status(403).json({ message: "تم تعطيل هذا الحساب." });
    }

    req.betaUser = { uid: decoded.uid, ...userData };
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: "جلسة غير صالحة، الرجاء تسجيل الدخول مجددًا." });
  }
}

/** يسمح فقط لمن كان status = active */
function requireActive(req, res, next) {
  if (req.betaUser.status !== "active") {
    return res.status(403).json({ message: "الحساب غير مُفعّل بعد." });
  }
  next();
}

/** يسمح فقط لـ owner أو admin */
function requireAdmin(req, res, next) {
  if (req.betaUser.role !== "owner" && req.betaUser.role !== "admin") {
    return res.status(403).json({ message: "لا تملك صلاحية القيام بهذا الإجراء." });
  }
  next();
}

/** يسمح فقط لـ owner */
function requireOwner(req, res, next) {
  if (req.betaUser.role !== "owner") {
    return res.status(403).json({ message: "هذا الإجراء متاح للمالك فقط." });
  }
  next();
}

module.exports = { requireAuth, requireActive, requireAdmin, requireOwner };
