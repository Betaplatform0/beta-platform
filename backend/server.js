require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const admin = require("firebase-admin");

// -----------------------------------------------------------------
// تهيئة Firebase Admin SDK
// يدعم طريقتين: ملف serviceAccountKey.json محليًا، أو متغيّر بيئة
// FIREBASE_SERVICE_ACCOUNT_JSON يحتوي محتوى الملف كنص JSON (للاستضافة)
// -----------------------------------------------------------------
let credential;
if (process.env.FIREBASE_PK_1 && process.env.FIREBASE_PK_2) {
  const privateKey = (process.env.FIREBASE_PK_1 + process.env.FIREBASE_PK_2).replace(/\\n/g, "\n");
  credential = admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  });
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
} else {
  credential = admin.credential.cert(require("./serviceAccountKey.json"));
}
admin.initializeApp({ credential });

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "https://betaplatform0.github.io",
    credentials: true,
  })
);
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
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
