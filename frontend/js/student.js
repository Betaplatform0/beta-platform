import { guardPage } from "./auth-guard.js";
import { BACKEND_URL } from "./firebase-config.js";
import { openPdfViewer } from "./pdf-viewer.js";
import { initTheme, initLang } from "./theme-lang.js";

let currentUser = null;

const roleLabel = { owner: "Owner", admin: "Admin", student: "Student" };
const statusLabel = { pending: "قيد المراجعة", active: "مفعّل", disabled: "معطّل" };

async function api(pathname) {
  const res = await fetch(`${BACKEND_URL}${pathname}`, {
    headers: { Authorization: `Bearer ${currentUser.idToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "حدث خطأ");
  return data;
}

async function loadFolders() {
  const { folders } = await api("/api/admin/folders");
  const { allowedFolders } = await api("/api/admin/permissions/me").catch(() => ({ allowedFolders: [] }));
  const allowed = allowedFolders || [];
  const visibleFolders = folders.filter((f) => allowed.includes(f.id));

  const grid = document.getElementById("folderGrid");
  if (visibleFolders.length === 0) {
    grid.innerHTML = "<p style='color:var(--muted)'>لا توجد مواد متاحة لك حاليًا.</p>";
    return;
  }
  grid.innerHTML = visibleFolders
    .map((f) => `<div class="folder-card" data-id="${f.id}" data-name="${f.name}"><div class="icon">📁</div><div>${f.name}</div></div>`)
    .join("");

  grid.querySelectorAll(".folder-card").forEach((card) => {
    card.addEventListener("click", () => openFolder(card.dataset.id, card.dataset.name));
  });
}

async function openFolder(folderId, folderName) {
  document.getElementById("foldersView").style.display = "none";
  document.getElementById("filesView").style.display = "block";
  const list = document.getElementById("filesList");
  list.innerHTML = "جارٍ التحميل...";

  const { files } = await api(`/api/files/by-folder/${folderId}`);
  list.innerHTML = files
    .map((f) => `<div class="file-row" data-id="${f.id}" data-name="${f.displayName}"><span>📄 ${f.displayName}</span><span>عرض</span></div>`)
    .join("") || "<p style='color:var(--muted)'>لا توجد ملفات في هذا الفولدر بعد.</p>";

  list.querySelectorAll(".file-row").forEach((row) => {
    row.addEventListener("click", () => {
      openPdfViewer(row.dataset.id, currentUser);
    });
  });
}

document.getElementById("backBtn").addEventListener("click", () => {
  document.getElementById("filesView").style.display = "none";
  document.getElementById("foldersView").style.display = "block";
});

// ------------ التنقل بين "الرئيسية" و"حسابي" ------------
document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item[data-view]").forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    document.getElementById("viewHome").style.display = item.dataset.view === "home" ? "block" : "none";
    document.getElementById("viewAccount").style.display = item.dataset.view === "account" ? "block" : "none";
    closeMobileMenu();
  });
});

function renderAccount() {
  document.getElementById("accFullName").textContent = currentUser.fullName || "-";
  document.getElementById("accPhone").textContent = currentUser.phone || "-";
  document.getElementById("accSeat").textContent = currentUser.seatNumber || "-";
  document.getElementById("accRole").textContent = roleLabel[currentUser.role] || currentUser.role;
  document.getElementById("accStatus").textContent = statusLabel[currentUser.status] || currentUser.status;
}

// ------------ القائمة الجانبية على الهاتف ------------
const sidebar = document.getElementById("studentSidebar");
const backdrop = document.getElementById("sidebarBackdrop");
document.getElementById("menuBtn").addEventListener("click", () => {
  sidebar.classList.add("open");
  backdrop.classList.add("open");
});
backdrop.addEventListener("click", closeMobileMenu);
function closeMobileMenu() {
  sidebar.classList.remove("open");
  backdrop.classList.remove("open");
}

// ------------ التهيئة ------------
(async function init() {
  initTheme();
  initLang();
  currentUser = await guardPage(["student"]);
  document.getElementById("welcomeText").textContent = `مرحبًا ${currentUser.fullName} 👋`;
  renderAccount();
  loadFolders();
})();
