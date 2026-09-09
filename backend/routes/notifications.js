const express = require("express");
const admin = require("firebase-admin");
const { requireAuth, requireActive, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const db = () => admin.firestore();

// إرسال إشعار - Owner و Admin
// targetType: "all" (كل الطلاب) أو "specific" (طالب معين عبر targetId)
router.post("/", requireAuth, requireActive, requireAdmin, async (req, res) => {
  const { title, message, targetType, targetId } = req.body;
  if (!title || !title.trim() || !message || !message.trim()) {
    return res.status(400).json({ message: "العنوان والنص مطلوبان." });
  }
  if (targetType !== "all" && targetType !== "specific") {
    return res.status(400).json({ message: "نوع الإرسال غير صالح." });
  }
  if (targetType === "specific" && !targetId) {
    return res.status(400).json({ message: "يجب اختيار طالب." });
  }

  await db().collection("notifications").add({
    title: title.trim(),
    message: message.trim(),
    targetType,
    targetId: targetType === "specific" ? targetId : null,
    createdBy: req.betaUser.uid,
    createdByName: req.betaUser.fullName || "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.json({ ok: true });
});

// جلب إشعارات المستخدم الحالي (عامة + الخاصة به)
router.get("/me", requireAuth, requireActive, async (req, res) => {
  const uid = req.betaUser.uid;

  const [allSnap, specificSnap] = await Promise.all([
    db().collection("notifications").where("targetType", "==", "all").orderBy("createdAt", "desc").limit(20).get(),
    db().collection("notifications").where("targetType", "==", "specific").where("targetId", "==", uid).orderBy("createdAt", "desc").limit(20).get(),
  ]);

  const notifications = [...allSnap.docs, ...specificSnap.docs]
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.createdAt && a.createdAt._seconds ? a.createdAt._seconds : 0;
      const tb = b.createdAt && b.createdAt._seconds ? b.createdAt._seconds : 0;
      return tb - ta;
    })
    .slice(0, 30);

  res.set("Cache-Control", "no-store");
  return res.json({ notifications });
});

module.exports = router;
