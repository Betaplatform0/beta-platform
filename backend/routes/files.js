const express = require("express");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");
const { requireAuth, requireActive } = require("../middleware/auth");

const router = express.Router();
const db = () => admin.firestore();
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

/**
 * تتحقق إن كان المستخدم مسموح له برؤية فولدر معيّن
 * owner/admin: مسموح لهم بكل شيء
 * student: يُرجع فقط الفولدرات الموجودة في permissions/{uid}.allowedFolders
 */
async function canAccessFolder(user, folderId) {
  if (user.role === "owner" || user.role === "admin") return true;
  const permSnap = await db().collection("permissions").doc(user.uid).get();
  if (!permSnap.exists) return false;
  const allowed = permSnap.data().allowedFolders || [];
  return allowed.includes(folderId);
}

/**
 * GET /api/files/:fileId/stream
 * يتحقق من صلاحية المستخدم قبل بث محتوى الـ PDF بايت بايت.
 * لا يوجد رابط عام - كل طلب يتطلب Authorization Header صالح.
 */
router.get("/:fileId/stream", requireAuth, requireActive, async (req, res) => {
  try {
    const fileSnap = await db().collection("files").doc(req.params.fileId).get();
    if (!fileSnap.exists) return res.status(404).json({ message: "الملف غير موجود." });

    const fileData = fileSnap.data();
    const allowed = await canAccessFolder(req.betaUser, fileData.folderId);
    if (!allowed) {
      return res.status(403).json({ message: "لا تملك صلاحية الوصول لهذا الملف." });
    }

    const filePath = path.join(UPLOAD_DIR, fileData.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "الملف غير موجود على الخادم." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline"); // بدون اسم حقيقي، بدون تنزيل مباشر
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error("file stream error:", err);
    return res.status(500).json({ message: "تعذر تحميل الملف." });
  }
});

/**
 * GET /api/files/by-folder/:folderId
 * يُرجع قائمة الملفات (metadata فقط) داخل فولدر معيّن بعد التحقق من الصلاحية
 */
router.get("/by-folder/:folderId", requireAuth, requireActive, async (req, res) => {
  try {
    const allowed = await canAccessFolder(req.betaUser, req.params.folderId);
    if (!allowed) return res.status(403).json({ message: "لا تملك صلاحية الوصول لهذا الفولدر." });

    const snap = await db().collection("files").where("folderId", "==", req.params.folderId).get();
    const files = snap.docs.map((d) => ({ id: d.id, displayName: d.data().displayName, sizeBytes: d.data().sizeBytes }));
    return res.json({ files });
  } catch (err) {
    console.error("list files error:", err);
    return res.status(500).json({ message: "تعذر جلب الملفات." });
  }
});

module.exports = router;
