const express = require("express");
const admin = require("firebase-admin");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

const db = () => admin.firestore();

/**
 * POST /api/device/verify
 * يُستدعى مباشرة بعد كل تسجيل دخول ناجح.
 * - إذا لم يكن هناك جهاز مرتبط بالحساب: يتم ربط هذا الجهاز فورًا.
 * - إذا كان هناك جهاز مرتبط ويطابق الجهاز الحالي: يُسمح بالدخول.
 * - إذا كان هناك جهاز مرتبط ولا يطابق: يُرفض الدخول تمامًا.
 */
router.post("/verify", requireAuth, async (req, res) => {
  const { deviceId, fingerprint } = req.body;
  if (!deviceId) {
    return res.status(400).json({ message: "بيانات الجهاز مفقودة." });
  }

  const userRef = db().collection("users").doc(req.betaUser.uid);
  const deviceRef = db().collection("devices").doc(req.betaUser.uid);

  try {
    const result = await db().runTransaction(async (tx) => {
      const deviceSnap = await tx.get(deviceRef);

      if (!deviceSnap.exists || !deviceSnap.data().deviceId) {
        // أول ربط للجهاز
        tx.set(deviceRef, {
          deviceId,
          fingerprint: fingerprint || null,
          linkedAt: admin.firestore.FieldValue.serverTimestamp(),
          userAgent: req.headers["user-agent"] || null,
        });
        tx.update(userRef, { deviceId });
        return { ok: true, firstLink: true };
      }

      const existing = deviceSnap.data();
      if (existing.deviceId === deviceId) {
        return { ok: true, firstLink: false };
      }

      return { ok: false };
    });

    if (!result.ok) {
      return res.status(403).json({ message: "هذا الحساب مرتبط بجهاز آخر." });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("device verify error:", err);
    return res.status(500).json({ message: "تعذر التحقق من الجهاز." });
  }
});

/**
 * POST /api/device/reset/:userId
 * إعادة تعيين جهاز مستخدم معيّن - للمالك فقط (يُتحقق منه داخل server.js)
 */
router.post("/reset/:userId", requireAuth, async (req, res) => {
  if (req.betaUser.role !== "owner") {
    return res.status(403).json({ message: "هذا الإجراء متاح للمالك فقط." });
  }
  const targetId = req.params.userId;
  try {
    await db().collection("devices").doc(targetId).delete();
    await db().collection("users").doc(targetId).update({ deviceId: null });
    return res.json({ ok: true });
  } catch (err) {
    console.error("device reset error:", err);
    return res.status(500).json({ message: "تعذر إعادة تعيين الجهاز." });
  }
});

module.exports = router;
