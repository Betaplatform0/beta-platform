require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const admin = require("firebase-admin");

// -----------------------------------------------------------------
// تهيئة Firebase Admin SDK
// حمّل ملف Service Account من Firebase Console > Project Settings >
// Service Accounts > Generate New Private Key، واحفظه باسم
// serviceAccountKey.json بجانب هذا الملف (ولا ترفعه إلى GitHub!)
// -----------------------------------------------------------------
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*", // في الإنتاج: ضع دومين الموقع فقط
    credentials: true,
  })
);
app.use(express.json());

// حماية من محاولات تسجيل الدخول/التسجيل المتكررة (Rate Limiting)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 30,
  message: { message: "محاولات كثيرة جدًا، الرجاء المحاولة لاحقًا." },
});
app.use("/api/auth", authLimiter);
app.use("/api/device", authLimiter);

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
});
app.use("/api", generalLimiter);

// المسارات
app.use("/api/auth", require("./routes/auth"));
app.use("/api/device", require("./routes/device"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/files", require("./routes/files"));
app.use("/api/admin", require("./routes/admin"));

app.get("/health", (req, res) => res.json({ ok: true, service: "beta-platform-backend" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Beta backend running on port ${PORT}`);
});
