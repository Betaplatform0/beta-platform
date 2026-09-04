const express = require("express");
const admin = require("firebase-admin");
const { requireAuth, requireActive, requireAdmin, requireOwner } = require("../middleware/auth");

const router = express.Router();
const db = () => admin.firestore();

// ================= الحسابات =================

router.get("/accounts", requireAuth, requireActive, requireAdmin, async (req, res) => {
  const snap = await db().collection("users").get();
  const accounts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return res.json({ accounts });
});

router.post("/accounts/:id/activate", requireAuth, requireActive, requireAdmin, async (req, res) => {
  await db().collection("users").doc(req.params.id).update({ status: "active" });
  return res.json({ ok: true });
});

router.post("/accounts/:id/disable", requireAuth, requireActive, requireAdmin, async (req, res) => {
  const target = await db().collection("users").doc(req.params.id).get();
  if (!target.exists) return res.status(404).json({ message: "الحساب غير موجود." });
  if (target.data().role === "owner") return res.status(403).json({ message: "لا يمكن تعطيل حساب المالك." });

  await db().collection("users").doc(req.params.id).update({ status: "disabled" });
  return res.json({ ok: true });
});

router.delete("/accounts/:id", requireAuth, requireActive, requireOwner, async (req, res) => {
  const target = await db().collection("users").doc(req.params.id).get();
  if (!target.exists) return res.status(404).json({ message: "الحساب غير موجود." });
  if (target.data().role === "owner") return res.status(403).json({ message: "لا يمكن حذف حساب المالك." });

  await db().collection("users").doc(req.params.id).delete();
  await db().collection("permissions").doc(req.params.id).delete().catch(() => {});
  await db().collection("devices").doc(req.params.id).delete().catch(() => {});
  await admin.auth().deleteUser(req.params.id).catch(() => {});
  return res.json({ ok: true });
});

router.post("/accounts/:id/make-admin", requireAuth, requireActive, requireOwner, async (req, res) => {
  const target = await db().collection("users").doc(req.params.id).get();
  if (!target.exists) return res.status(404).json({ message: "الحساب غير موجود." });
  if (target.data().role === "owner") return res.status(400).json({ message: "هذا الحساب هو المالك بالفعل." });

  await db().collection("users").doc(req.params.id).update({ role: "admin" });
  return res.json({ ok: true });
});

router.post("/accounts/:id/remove-admin", requireAuth, requireActive, requireOwner, async (req, res) => {
  const target = await db().collection("users").doc(req.params.id).get();
  if (!target.exists) return res.status(404).json({ message: "الحساب غير موجود." });
  if (target.data().role !== "admin") return res.status(400).json({ message: "الحساب ليس أدمن." });

  await db().collection("users").doc(req.params.id).update({ role: "student" });
  return res.json({ ok: true });
});

// ================= الفولدرات (عامة / خاصة) =================

router.get("/folders", requireAuth, requireActive, async (req, res) => {
  const snap = await db().collection("folders").orderBy("createdAt", "asc").get();
  const folders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return res.json({ folders });
});

router.post("/folders", requireAuth, requireActive, requireOwner, async (req, res) => {
  const { name, type } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "اسم الفولدر مطلوب." });
  const folderType = type === "public" ? "public" : "private";
  const docRef = await db().collection("folders").add({
    name: name.trim(),
    type: folderType,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return res.json({ ok: true, id: docRef.id });
});

router.put("/folders/:id", requireAuth, requireActive, requireOwner, async (req, res) => {
  const { name, type } = req.body;
  const updates = {};
  if (name && name.trim()) updates.name = name.trim();
  if (type === "public" || type === "private") updates.type = type;
  if (Object.keys(updates).length === 0) return res.status(400).json({ message: "لا توجد بيانات للتحديث." });
  await db().collection("folders").doc(req.params.id).update(updates);
  return res.json({ ok: true });
});

router.delete("/folders/:id", requireAuth, requireActive, requireOwner, async (req, res) => {
  const filesSnap = await db().collection("files").where("folderId", "==", req.params.id).get();
  const fs = require("fs");
  const path = require("path");
  const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
  for (const doc of filesSnap.docs) {
    const filePath = path.join(UPLOAD_DIR, doc.data().storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await doc.ref.delete();
  }
  await db().collection("folders").doc(req.params.id).delete();
  return res.json({ ok: true });
});

// ================= صلاحيات الطلاب (للفولدرات الخاصة فقط) =================

router.get("/permissions/me", requireAuth, requireActive, async (req, res) => {
  const snap = await db().collection("permissions").doc(req.betaUser.uid).get();
  return res.json({ allowedFolders: snap.exists ? snap.data().allowedFolders || [] : [] });
});

router.get("/permissions/:userId", requireAuth, requireActive, requireAdmin, async (req, res) => {
  const snap = await db().collection("permissions").doc(req.params.userId).get();
  return res.json({ allowedFolders: snap.exists ? snap.data().allowedFolders || [] : [] });
});

router.put("/permissions/:userId", requireAuth, requireActive, requireAdmin, async (req, res) => {
  const { allowedFolders } = req.body;
  if (!Array.isArray(allowedFolders)) {
    return res.status(400).json({ message: "قائمة الفولدرات غير صالحة." });
  }
  await db().collection("permissions").doc(req.params.userId).set({ allowedFolders }, { merge: true });
  return res.json({ ok: true });
});

// ================= إحصائيات لوحة التحكم =================

router.get("/stats", requireAuth, requireActive, requireAdmin, async (req, res) => {
  const usersSnap = await db().collection("users").get();
  const foldersSnap = await db().collection("folders").get();
  const filesSnap = await db().collection("files").get();

  let students = 0, activeCount = 0, pendingCount = 0, admins = 0;
  usersSnap.docs.forEach((d) => {
    const u = d.data();
    if (u.role === "student") students++;
    if (u.role === "admin") admins++;
    if (u.status === "active") activeCount++;
    if (u.status === "pending") pendingCount++;
  });

  return res.json({
    students,
    activeCount,
    pendingCount,
    admins,
    folders: foldersSnap.size,
    files: filesSnap.size,
  });
});

// ================= بيانات الأجهزة =================

router.get("/devices", requireAuth, requireActive, requireAdmin, async (req, res) => {
  const devicesSnap = await db().collection("devices").get();
  const usersSnap = await db().collection("users").get();
  const usersMap = {};
  usersSnap.docs.forEach((d) => (usersMap[d.id] = d.data()));

  const devices = devicesSnap.docs.map((d) => {
    const data = d.data();
    const user = usersMap[d.id] || {};
    return {
      userId: d.id,
      userName: user.fullName || "-",
      deviceId: data.deviceId,
      userAgent: data.userAgent || null,
      linkedAt: data.linkedAt || null,
    };
  });

  return res.json({ devices });
});

module.exports = router;
