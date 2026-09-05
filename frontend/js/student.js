import { guardPage } from "./auth-guard.js";
import { BACKEND_URL } from "./firebase-config.js";
import { openPdfViewer } from "./pdf-viewer.js";
import { initTheme, initLang } from "./theme-lang.js";

let currentUser = null;
let foldersCache = [];
let allowedSet = new Set();
let folderStack = []; // {id, name}
let dataLoaded = false;

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

function canSee(folder) {
  return folder.type === "public" || allowedSet.has(folder.id);
}

function currentParentId() {
  return folderStack.length ? folderStack[folderStack.length - 1].id : null;
}

function renderBreadcrumb() {
  const bc = document.getElementById("folderBreadcrumb");
  if (!bc) return;
  const rootLabel = `<span class="breadcrumb-item" data-index="-1" style="cursor:pointer;color:var(--primary);">📁 ملفاتي</span>`;
  const items = folderStack.map((f, i) => `<span> / </span><span class="breadcrumb-item" data-index="${i}" style="cursor:pointer;color:var(--primary);">${f.name}</span>`);
  bc.innerHTML = rootLabel + items.join("");
  bc.querySelectorAll(".breadcrumb-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.index, 10);
      folderStack = idx === -1 ? [] : folderStack.slice(0, idx + 1);
      renderCurrentLevel();
    });
  });
}

async function renderCurrentLevel() {
  renderBreadcrumb();
  const parentId = currentParentId();

  const visibleFolders = foldersCache.filter((f) => (f.parentId || null) === parentId && canSee(f));
  const grid = document.getElementById("folderGrid");
  grid.innerHTML =
    visibleFolders
      .map((f) => `<div class="folder-card" data-id="${f.id}" data-name="${f.name}"><div class="icon">📁</div><div>${f.name}</div></div>`)
      .join("") || "";

  grid.querySelectorAll(".folder-card").forEach((card) => {
    card.addEventListener("click", () => {
      folderStack.push({ id: card.dataset.id, name: card.dataset.name });
      renderCurrentLevel();
    });
  });

  const filesSection = document.getElementById("filesInLevelSection");
  const filesList = document.getElementById("filesInLevelList");

  if (parentId) {
    filesSection.style.display = "block";
    try {
      const { files } = await api(`/api/files/by-folder/${parentId}`);
      filesList.innerHTML =
        files
          .map((f) => `<div class="file-row" data-id="${f.id}"><span>📄 ${f.displayName}</span><span>عرض</span></div>`)
          .join("") || "<p style='color:var(--muted)'>لا توجد ملفات في هذا الفولدر.</p>";

      filesList.querySelectorAll(".file-row").forEach((row) => {
        row.addEventListener("click", () => openPdfViewer(row.dataset.id, currentUser));
      });
    } catch (err) {
      filesList.innerHTML = "<p style='color:var(--muted)'>لا توجد صلاحية لعرض ملفات هذا الفولدر.</p>";
    }
  } else {
    filesSection.style.display = "none";
    filesList.innerHTML = "";
  }

  if (visibleFolders.length === 0 && !parentId) {
    grid.innerHTML = "<p style='color:var(--muted)'>لا توجد مواد متاحة لك حاليًا.</p>";
  }
}

async function ensureDataLoaded() {
  if (dataLoaded) return;
  const { folders } = await api("/api/admin/folders");
  foldersCache = folders;

  const { allowedFolders } = await api("/api/admin/permissions/me").catch(() => ({ allowedFolders: [] }));
  allowedSet = new Set(allowedFolders || []);
  dataLoaded = true;
}

async function openFilesView() {
  await ensureDataLoaded();
  renderCurrentLevel();
}

// ------------ التنقل بين "الرئيسية" و"ملفاتي" و"حسابي" ------------
function switchView(view) {
  document.querySelectorAll(".nav-item[data-view]").forEach((i) => i.classList.remove("active"));
  const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navItem) navItem.classList.add("active");

  document.getElementById("viewHome").style.display = view === "home" ? "block" : "none";
  document.getElementById("viewFiles").style.display = view === "files" ? "block" : "none";
  document.getElementById("viewAccount").style.display = view === "account" ? "block" : "none";

  if (view === "files") openFilesView();
  closeMobileMenu();
}

document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});

document.getElementById("quickFilesBtn").addEventListener("click", () => switchView("files"));
document.getElementById("quickAccountBtn").addEventListener("click", () => switchView("account"));

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
})();
