import { BACKEND_URL } from "./firebase-config.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let pdfDoc = null;
let currentPage = 1;
let currentScale = 1;

const overlay = document.getElementById("pdfOverlay");
const canvas = document.getElementById("pdfCanvas");
const ctx = canvas.getContext("2d");
const pageInfo = document.getElementById("pageInfo");
const watermarkLayer = document.getElementById("watermarkLayer");

let focusShield = null;

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
    const buffer = await res.arrayBuffer();

    pdfDoc = await pdfjsLib.getDocument({
      data: buffer,
      cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/",
      disableFontFace: false,
      useSystemFonts: false,
    }).promise;

    currentPage = 1;

    const firstPage = await pdfDoc.getPage(1);
    const naturalViewport = firstPage.getViewport({ scale: 1 });
    const wrapWidth = document.getElementById("pdfCanvasWrap").clientWidth - 40;
    currentScale = wrapWidth / naturalViewport.width;

    renderPage(currentPage);
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

async function renderPage(num) {
  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: currentScale });

  const dpr = Math.max(window.devicePixelRatio || 1, 2.5);

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  await page.render({ canvasContext: ctx, viewport, intent: "print" }).promise;
  pageInfo.textContent = `صفحة ${num} / ${pdfDoc.numPages}`;
}

document.getElementById("prevPage").addEventListener("click", () => {
  if (currentPage > 1) { currentPage--; renderPage(currentPage); }
});
document.getElementById("nextPage").addEventListener("click", () => {
  if (pdfDoc && currentPage < pdfDoc.numPages) { currentPage++; renderPage(currentPage); }
});
document.getElementById("zoomIn").addEventListener("click", () => { currentScale += 0.2; renderPage(currentPage); });
document.getElementById("zoomOut").addEventListener("click", () => {
  currentScale = Math.max(0.5, currentScale - 0.2);
  renderPage(currentPage);
});
document.getElementById("fullscreenBtn").addEventListener("click", () => {
  if (overlay.requestFullscreen) overlay.requestFullscreen();
});
document.getElementById("closeViewer").addEventListener("click", closeViewer);

function closeViewer() {
  overlay.style.display = "none";
  pdfDoc = null;
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
