import { BACKEND_URL } from "./firebase-config.js";

const overlay = document.getElementById("pdfOverlay");
const canvasWrap = document.getElementById("pdfCanvasWrap");
const pageInfo = document.getElementById("pageInfo");
const watermarkLayer = document.getElementById("watermarkLayer");

let focusShield = null;
let iframeEl = null;
let currentObjectUrl = null;

function ensureFocusShield() {
  if (focusShield) return focusShield;
  focusShield = document.createElement("div");
  focusShield.style.cssText = "position:fixed;inset:0;background:#000;z-index:1001;display:none;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;";
  focusShield.textContent = "المحتوى مخفي مؤقتًا لحماية الملف";
  overlay.appendChild(focusShield);
  return focusShield;
}

function hideContentForSafety() {
  if (overlay.style.display !== "flex") return;
  ensureFocusShield().style.display = "flex";
}

function showContentAgain() {
  if (focusShield) focusShield.style.display = "none";
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) hideContentForSafety();
  else showContentAgain();
});
window.addEventListener("blur", hideContentForSafety);
window.addEventListener("focus", showContentAgain);

export async function openPdfViewer(fileId, user) {
  overlay.style.display = "flex";
  buildWatermark(user);
  ensureFocusShield();
  pageInfo.textContent = "جارٍ التحميل...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/files/${fileId}/stream`, {
      headers: { Authorization: `Bearer ${user.idToken}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || "لا يمكن فتح هذا الملف.");
      closeViewer();
      return;
    }
    const blob = await res.blob();

    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(blob);

    if (iframeEl) iframeEl.remove();
    iframeEl = document.createElement("iframe");
    iframeEl.id = "pdfNativeFrame";
    iframeEl.style.cssText = "width:100%;height:100%;border:none;background:#fff;";
    iframeEl.src = `${currentObjectUrl}#toolbar=0&navpanes=0&scrollbar=1`;
    canvasWrap.insertBefore(iframeEl, watermarkLayer);

    pageInfo.textContent = "";
  } catch (err) {
    console.error(err);
    alert("تعذر تحميل الملف.");
    closeViewer();
  }
}

function buildWatermark(user) {
  const label = `${user.fullName} - ${user.seatNumber}`;
  const cells = Array.from({ length: 40 }, () => `<span>${label}</span>`).join("");
  watermarkLayer.innerHTML = cells;
}

document.getElementById("fullscreenBtn").addEventListener("click", () => {
  if (overlay.requestFullscreen) overlay.requestFullscreen();
});
document.getElementById("closeViewer").addEventListener("click", closeViewer);

function closeViewer() {
  overlay.style.display = "none";
  if (iframeEl) { iframeEl.remove(); iframeEl = null; }
  if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
  showContentAgain();
}

overlay.addEventListener("contextmenu", (e) => e.preventDefault());
overlay.addEventListener("keydown", (e) => {
  const blocked = (e.ctrlKey || e.metaKey) && ["p", "s", "u", "c", "a"].includes(e.key.toLowerCase());
  if (blocked) e.preventDefault();
});
document.addEventListener("keydown", (e) => {
  if (overlay.style.display !== "flex") return;
  const blocked = (e.ctrlKey || e.metaKey) && ["p", "s", "u", "c", "a"].includes(e.key.toLowerCase());
  if (blocked) e.preventDefault();
});
