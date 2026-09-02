const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");
const { requireAuth, requireOwner } = require("../middleware/auth");

const router = express.Router();
const db = () => admin.firestore();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // اسم عشوائي غير قابل للتخمين على القرص - الاسم الحقيقي يُحفظ في Firestore فقط
    const safeExt = path.extname(file.originalname).toLowerCase() === ".pdf" ? ".pdf" : "";
    cb(null, `${uuidv4()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("يُسمح فقط برفع ملفات PDF."));
    }
    cb(null, true);
  },
});

/**
 * POST /api/upload
 * form-data: file, folderId, displayName
 * Owner فقط
 */
router.post("/", requireAuth, requireOwner, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "لم يتم إرفاق ملف." });
    const { folderId, displayName } = req.body;
    if (!folderId) return res.status(400).json({ message: "الفولدر مطلوب." });

    const folderSnap = await db().collection("folders").doc(folderId).get();
    if (!folderSnap.exists) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "الفولدر غير موجود." });
    }

    const fileDoc = await db().collection("files").add({
      folderId,
      displayName: displayName || req.file.originalname,
      storedName: req.file.filename,
      sizeBytes: req.file.size,
      uploadedBy: req.betaUser.uid,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ ok: true, fileId: fileDoc.id });
  } catch (err) {
    console.error("upload error:", err);
    return res.status(500).json({ message: err.message || "فشل رفع الملف." });
  }
});

module.exports = router;
