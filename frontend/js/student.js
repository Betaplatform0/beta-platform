import { guardPage } from "./auth-guard.js";
import { api, escapeHtml } from "./api-client.js";
import { openPdfViewer } from "./pdf-viewer.js";
import { initTheme, initLang } from "./theme-lang.js";

let currentUser = null;
let foldersCache = [];
let folderStack = [];
let dataLoaded = false;
let currentView = "home";

const roleLabel = { owner: "Owner", admin: "Admin", student: "Student" };
const statusLabel = { pending: "قيد المراجعة", active: "مفعّل", disabled: "معطّل" };

function currentParentId() {
  return folderStack.length ? folderStack[folderStack.length - 1].id : null;
}

function renderBreadcrumb() {
  const bc = document.getElementById("folderBreadcrumb");
  if (!bc) return;
  const rootLabel = `<span class="breadcrumb-item" data-index="-1" style="cursor:pointer;color:var(--primary);">📁 ملفاتي</span>`;
  const items = folderStack.map((f, i) => `<span> / </span><span class="breadcrumb-item" data-index="${i}" style="cursor:pointer;color:var(--primary);">${escapeHtml(f.name)}</span>`);
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

  // الفولدرات كلها جاية من endpoint خاص بالطالب بيرجع بس المسموح بيها أصلًا
  const visibleFolders = foldersCache.filter((f) => (f.parentId || null) === parentId);
  const grid = document.getElementById("folderGrid");
  grid.innerHTML =
    visibleFolders
      .map((f) => `<div class="folder-card" data-id="${f.id}" data-name="${escapeHtml(f.name)}"><div class="icon">📁</div><div>${escapeHtml(f.name)}</div></div>`)
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
          .map((f) => `<div class="file-row" data-id="${f.id}"><span>📄 ${escapeHtml(f.displayName)}</span><span>عرض</span></div>`)
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

  const grid = document.getElementById("folderGrid");
  grid.innerHTML = "<p style='color:var(--muted)'>جارٍ التحميل...</p>";

  try {
    const { folders } = await api("/api/student/folders");
    foldersCache = folders;
    dataLoaded = true;
  } catch (err) {
    console.error("تعذر تحميل البيانات");
    grid.innerHTML = `
      <p style="color:var(--danger)">تعذر تحميل الفولدرات. تأكد من اتصالك بالإنترنت وحاول تاني.</p>
      <button class="btn secondary" style="width:auto;" id="retryLoadBtn">إعادة المحاولة</button>
    `;
    document.getElementById("retryLoadBtn").addEventListener("click", async () => {
      await ensureDataLoaded();
      if (dataLoaded) renderCurrentLevel();
    });
    throw err;
  }
}

async function openFilesView() {
  try {
    await ensureDataLoaded();
    renderCurrentLevel();
  } catch (err) {
    // الرسالة ظهرت بالفعل جوه ensureDataLoaded
  }
}

async function openNotificationsView() {
  const list = document.getElementById("notificationsList");
  list.innerHTML = "جارٍ التحميل...";
  try {
    const { notifications } = await api("/api/notifications/me");
    if (!notifications || notifications.length === 0) {
      list.innerHTML = "<p style='color:var(--muted)'>لا توجد إشعارات حاليًا.</p>";
      return;
    }
    list.innerHTML = notifications
      .map((n) => {
        const time = n.createdAt && n.createdAt._seconds ? new Date(n.createdAt._seconds * 1000).toLocaleString("ar-EG") : "";
        return `<div class="card" style="margin-bottom:10px;">
          <div style="font-weight:700;margin-bottom:6px;">🔔 ${escapeHtml(n.title)}</div>
          <div style="color:var(--muted);font-size:0.9rem;margin-bottom:8px;">${escapeHtml(n.message)}</div>
          <div style="color:var(--muted);font-size:0.75rem;">${time}</div>
        </div>`;
      })
      .join("");
  } catch (err) {
    list.innerHTML = `<p style='color:var(--danger)'>تعذر تحميل الإشعارات.</p>`;
  }
}

function applyView(view) {
  document.querySelectorAll(".nav-item[data-view]").forEach((i) => i.classList.remove("active"));
  const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navItem) navItem.classList.add("active");

  document.getElementById("viewHome").style.display = view === "home" ? "block" : "none";
  document.getElementById("viewFiles").style.display = view === "files" ? "block" : "none";
  document.getElementById("viewAccount").style.display = view === "account" ? "block" : "none";
  document.getElementById("viewNotifications").style.display = view === "notifications" ? "block" : "none";

  if (view === "files") openFilesView();
  if (view === "notifications") openNotificationsView();
  closeMobileMenu();
  currentView = view;
}

function switchView(view) {
  applyView(view);
  history.pushState({ betaView: view }, "", "#" + view);
}

document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});

window.addEventListener("popstate", () => {
  applyView("home");
  history.pushState({ betaView: "home" }, "", "#home");
});

function renderAccount() {
  document.getElementById("accFullName").textContent = currentUser.fullName || "-";
  document.getElementById("accPhone").textContent = currentUser.phone || "-";
  document.getElementById("accSeat").textContent = currentUser.seatNumber || "-";
  document.getElementById("accRole").textContent = roleLabel[currentUser.role] || currentUser.role;
  document.getElementById("accStatus").textContent = statusLabel[currentUser.status] || currentUser.status;
}

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

(async function init() {
  initTheme();
  initLang();
  currentUser = await guardPage(["student"]);
  document.getElementById("welcomeText").textContent = `مرحبًا ${currentUser.fullName} 👋`;
  renderAccount();
  history.replaceState({ betaView: "home" }, "", "#home");
})();
