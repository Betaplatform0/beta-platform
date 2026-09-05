import { guardPage } from "./auth-guard.js";
import { BACKEND_URL } from "./firebase-config.js";
import { initTheme, initLang } from "./theme-lang.js";

let currentUser = null;
let foldersCache = [];
let folderStack = [];

const roleLabel = { owner: "Owner", admin: "Admin", student: "Student" };
const statusLabel = { pending: "قيد المراجعة", active: "مفعّل", disabled: "معطّل" };

function api(pathname, options = {}) {
  return fetch(`${BACKEND_URL}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentUser.idToken}`,
      ...(options.headers || {}),
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || "حدث خطأ");
    return data;
  });
}

function parseUserAgent(ua) {
  if (!ua) return { browser: "غير معروف", os: "غير معروف" };
  let browser = "غير معروف";
  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/") && !ua.includes("OPR")) browser = "Google Chrome";
  else if (ua.includes("Firefox/")) browser = "Mozilla Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("OPR")) browser = "Opera";

  let os = "غير معروف";
  if (ua.includes("Windows NT 10")) os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}

function folderPathLabel(folder) {
  const parts = [folder.name];
  let current = folder;
  while (current.parentId) {
    const parent = foldersCache.find((f) => f.id === current.parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  return parts.join(" / ");
}

// ------------ تبديل التبويبات ------------
document.querySelectorAll(".nav-item[data-tab]").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item[data-tab]").forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    document.querySelectorAll("main > section").forEach((s) => (s.style.display = "none"));
    document.getElementById(`tab-${item.dataset.tab}`).style.display = "block";
    if (item.dataset.tab === "accounts") loadAccounts();
    if (item.dataset.tab === "folders") { folderStack = []; loadFolders(); }
    if (item.dataset.tab === "files") loadFilesTab();
    if (item.dataset.tab === "permissions") loadPermissionsTab();
    if (item.dataset.tab === "devices") loadDevices();
  });
});

// ------------ الرئيسية ------------
async function loadStats() {
  const s = await api("/api/admin/stats");
  document.getElementById("statStudents").textContent = s.students;
  document.getElementById("statActive").textContent = s.activeCount;
  document.getElementById("statPending").textContent = s.pendingCount;
  document.getElementById("statAdmins").textContent = s.admins;
  document.getElementById("statFolders").textContent = s.folders;
  document.getElementById("statFiles").textContent = s.files;
}

// ------------ الحسابات ------------
async function loadAccounts() {
  const { accounts } = await api("/api/admin/accounts");
  const tbody = document.getElementById("accountsTable");
  tbody.innerHTML = accounts
    .map((a) => {
      const actions = [];
      if (a.status === "pending") actions.push(`<button class="btn small" onclick="betaActivate('${a.id}')">تفعيل</button>`);
      if (a.status === "active" && a.role !== "owner") actions.push(`<button class="btn small danger" onclick="betaDisable('${a.id}')">تعطيل</button>`);
      if (a.status === "disabled") actions.push(`<button class="btn small" onclick="betaActivate('${a.id}')">تفعيل</button>`);
      if (currentUser.role === "owner" && a.role === "student") actions.push(`<button class="btn small secondary" onclick="betaMakeAdmin('${a.id}')">جعله Admin</button>`);
      if (currentUser.role === "owner" && a.role === "admin") actions.push(`<button class="btn small secondary" onclick="betaRemoveAdmin('${a.id}')">إزالة Admin</button>`);
      if (currentUser.role === "owner" && a.role !== "owner") actions.push(`<button class="btn small danger" onclick="betaDelete('${a.id}')">حذف</button>`);

      return `<tr>
        <td>${a.fullName || "-"}</td>
        <td>${a.phone || "-"}</td>
        <td>${a.seatNumber || "-"}</td>
        <td><span class="badge ${a.role}">${roleLabel[a.role] || a.role}</span></td>
        <td><span class="badge ${a.status}">${statusLabel[a.status] || a.status}</span></td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;">${actions.join("")}</td>
      </tr>`;
    })
    .join("");
}

window.betaActivate = async (id) => { await api(`/api/admin/accounts/${id}/activate`, { method: "POST" }); loadAccounts(); };
window.betaDisable = async (id) => { await api(`/api/admin/accounts/${id}/disable`, { method: "POST" }); loadAccounts(); };
window.betaMakeAdmin = async (id) => { await api(`/api/admin/accounts/${id}/make-admin`, { method: "POST" }); loadAccounts(); };
window.betaRemoveAdmin = async (id) => { await api(`/api/admin/accounts/${id}/remove-admin`, { method: "POST" }); loadAccounts(); };
window.betaDelete = async (id) => {
  if (!confirm("هل أنت متأكد من حذف هذا الحساب نهائيًا؟")) return;
  try {
    await api(`/api/admin/accounts/${id}`, { method: "DELETE" });
    loadAccounts();
  } catch (err) {
    alert("فشل حذف الحساب: " + err.message);
  }
};

// ------------ الفولدرات (شجرية) ------------
async function fetchAllFolders() {
  const { folders } = await api("/api/admin/folders");
  foldersCache = folders;
}

function currentParentId() {
  return folderStack.length ? folderStack[folderStack.length - 1].id : null;
}

function renderBreadcrumb() {
  const bc = document.getElementById("folderBreadcrumb");
  const rootLabel = `<span class="breadcrumb-item" data-index="-1" style="cursor:pointer;color:var(--primary);">📁 الرئيسية</span>`;
  const items = folderStack.map((f, i) => `<span> / </span><span class="breadcrumb-item" data-index="${i}" style="cursor:pointer;color:var(--primary);">${f.name}</span>`);
  bc.innerHTML = rootLabel + items.join("");
  bc.querySelectorAll(".breadcrumb-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.index, 10);
      folderStack = idx === -1 ? [] : folderStack.slice(0, idx + 1);
      renderFolderView();
    });
  });
}

function renderFolderView() {
  renderBreadcrumb();
  const parentId = currentParentId();
  const children = foldersCache.filter((f) => (f.parentId || null) === parentId);
  const grid = document.getElementById("folderGrid");

  if (children.length === 0) {
    grid.innerHTML = "<p style='color:var(--muted)'>لا توجد فولدرات هنا بعد.</p>";
    return;
  }

  grid.innerHTML = children
    .map(
      (f) => `<div class="folder-card" data-id="${f.id}">
        <div class="icon">${f.type === "public" ? "🌐" : "🔒"}</div>
        <div>${f.name}</div>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:4px;">${f.type === "public" ? "عام" : "خاص"}</div>
        <div style="margin-top:10px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
          <button class="btn small secondary" data-action="rename" data-id="${f.id}" data-name="${f.name.replace(/"/g, "&quot;")}">تعديل الاسم</button>
          <button class="btn small secondary" data-action="toggle" data-id="${f.id}" data-type="${f.type}">${f.type === "public" ? "اجعله خاص" : "اجعله عام"}</button>
          <button class="btn small danger" data-action="delete" data-id="${f.id}">حذف</button>
        </div>
      </div>`
    )
    .join("");

  grid.querySelectorAll(".folder-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const id = card.dataset.id;
      const folder = foldersCache.find((f) => f.id === id);
      folderStack.push({ id: folder.id, name: folder.name });
      renderFolderView();
    });
  });

  grid.querySelectorAll('button[data-action="rename"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const name = prompt("الاسم الجديد للفولدر:", btn.dataset.name);
      if (!name || !name.trim()) return;
      try {
        await api(`/api/admin/folders/${btn.dataset.id}`, { method: "PUT", body: JSON.stringify({ name: name.trim() }) });
        await fetchAllFolders();
        renderFolderView();
      } catch (err) {
        alert("فشل التعديل: " + err.message);
      }
    });
  });

  grid.querySelectorAll('button[data-action="toggle"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newType = btn.dataset.type === "public" ? "private" : "public";
      try {
        await api(`/api/admin/folders/${btn.dataset.id}`, { method: "PUT", body: JSON.stringify({ type: newType }) });
        await fetchAllFolders();
        renderFolderView();
      } catch (err) {
        alert("فشل تغيير نوع الفولدر: " + err.message);
      }
    });
  });

  grid.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("سيتم حذف الفولدر وكل الفولدرات الفرعية والملفات بداخله. متابعة؟")) return;
      try {
        await api(`/api/admin/folders/${btn.dataset.id}`, { method: "DELETE" });
        await fetchAllFolders();
        renderFolderView();
      } catch (err) {
        alert("فشل حذف الفولدر: " + err.message);
      }
    });
  });
}

async function loadFolders() {
  await fetchAllFolders();
  renderFolderView();
}

document.getElementById("addFolderBtn").addEventListener("click", async () => {
  const input = document.getElementById("newFolderName");
  const typeSelect = document.getElementById("newFolderType");
  if (!input.value.trim()) return;
  try {
    await api("/api/admin/folders", {
      method: "POST",
      body: JSON.stringify({ name: input.value.trim(), type: typeSelect.value, parentId: currentParentId() }),
    });
    input.value = "";
    await fetchAllFolders();
    renderFolderView();
  } catch (err) {
    alert("فشل إنشاء الفولدر: " + err.message);
  }
});

// ------------ الملفات (مع زرار حذف) ------------
async function loadFilesTab() {
  if (foldersCache.length === 0) await fetchAllFolders();
  const select = document.getElementById("uploadFolderSelect");
  select.innerHTML = foldersCache
    .map((f) => `<option value="${f.id}">${folderPathLabel(f)} (${f.type === "public" ? "عام" : "خاص"})</option>`)
    .join("");
  if (foldersCache[0]) loadFilesForFolder(select.value);
  select.onchange = () => loadFilesForFolder(select.value);
}

async function loadFilesForFolder(folderId) {
  const list = document.getElementById("filesList");
  if (!folderId) { list.innerHTML = "<p style='color:var(--muted)'>لا توجد فولدرات بعد.</p>"; return; }
  list.innerHTML = "جارٍ التحميل...";
  try {
    const data = await api(`/api/files/by-folder/${folderId}`);
    list.innerHTML =
      (data.files || [])
        .map(
          (f) => `<div class="file-row">
            <span>📄 ${f.displayName}</span>
            <span style="display:flex;align-items:center;gap:10px;">
              ${(f.sizeBytes / 1024 / 1024).toFixed(2)} MB
              <button class="btn small danger" data-action="delete-file" data-id="${f.id}" data-folder="${folderId}">حذف</button>
            </span>
          </div>`
        )
        .join("") || "<p style='color:var(--muted)'>لا توجد ملفات بعد.</p>";

    list.querySelectorAll('button[data-action="delete-file"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("هل أنت متأكد من حذف هذا الملف؟")) return;
        try {
          await api(`/api/files/${btn.dataset.id}`, { method: "DELETE" });
          loadFilesForFolder(btn.dataset.folder);
        } catch (err) {
          alert("فشل حذف الملف: " + err.message);
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p style='color:var(--danger)'>تعذر جلب الملفات: ${err.message}</p>`;
  }
}

document.getElementById("uploadBtn").addEventListener("click", async () => {
  const folderId = document.getElementById("uploadFolderSelect").value;
  const fileInput = document.getElementById("uploadFileInput");
  const msg = document.getElementById("uploadMsg");
  if (!folderId) { msg.textContent = "أنشئ فولدر أولًا من تبويب الفولدرات."; msg.className = "msg error"; return; }
  if (!fileInput.files[0]) { msg.textContent = "اختر ملفًا أولًا."; msg.className = "msg error"; return; }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  formData.append("folderId", folderId);
  formData.append("displayName", fileInput.files[0].name);

  msg.textContent = "جارٍ الرفع...";
  msg.className = "msg";
  try {
    const res = await fetch(`${BACKEND_URL}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${currentUser.idToken}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    msg.textContent = "تم رفع الملف بنجاح.";
    msg.className = "msg success";
    fileInput.value = "";
    loadFilesForFolder(folderId);
  } catch (err) {
    msg.textContent = err.message || "فشل الرفع.";
    msg.className = "msg error";
  }
});

// ------------ الصلاحيات (مع بحث + مسار كامل للفولدرات) ------------
async function loadPermissionsTab() {
  if (foldersCache.length === 0) await fetchAllFolders();
  const privateFolders = foldersCache.filter((f) => f.type !== "public");
  const { accounts } = await api("/api/admin/accounts");
  const students = accounts.filter((a) => a.role === "student");

  const select = document.getElementById("permStudentSelect");
  const searchInput = document.getElementById("permStudentSearch");

  function renderOptions(list) {
    select.innerHTML = list.map((s) => `<option value="${s.id}">${s.fullName} (${s.phone})</option>`).join("");
  }

  renderOptions(students);

  searchInput.oninput = () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = students.filter(
      (s) => (s.fullName || "").toLowerCase().includes(q) || (s.phone || "").includes(q) || (s.seatNumber || "").toLowerCase().includes(q)
    );
    renderOptions(filtered);
    if (filtered[0]) renderPerms();
    else document.getElementById("permFoldersList").innerHTML = "<p style='color:var(--muted)'>لا يوجد طالب مطابق.</p>";
  };

  async function renderPerms() {
    const studentId = select.value;
    if (!studentId) return;
    const { allowedFolders } = await api(`/api/admin/permissions/${studentId}`);
    const container = document.getElementById("permFoldersList");
    if (privateFolders.length === 0) {
      container.innerHTML = "<p style='color:var(--muted)'>لا توجد فولدرات خاصة حاليًا (كل الفولدرات عامة).</p>";
      return;
    }
    container.innerHTML = privateFolders
      .map(
        (f) => `<label style="display:flex;align-items:center;gap:8px;padding:8px 0;">
          <input type="checkbox" value="${f.id}" ${allowedFolders.includes(f.id) ? "checked" : ""} />
          ${folderPathLabel(f)}
        </label>`
      )
      .join("");
  }

  select.onchange = renderPerms;
  if (students[0]) renderPerms();

  document.getElementById("savePermsBtn").onclick = async () => {
    const studentId = select.value;
    const checked = [...document.querySelectorAll("#permFoldersList input:checked")].map((i) => i.value);
    const msg = document.getElementById("permMsg");
    try {
      await api(`/api/admin/permissions/${studentId}`, { method: "PUT", body: JSON.stringify({ allowedFolders: checked }) });
      msg.textContent = "تم حفظ الصلاحيات.";
      msg.className = "msg success";
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "msg error";
    }
  };
}

// ------------ الأجهزة (مع رسائل خطأ واضحة) ------------
async function loadDevices() {
  const { devices } = await api("/api/admin/devices");
  const tbody = document.getElementById("devicesTable");
  tbody.innerHTML = devices
    .map((d) => {
      const info = parseUserAgent(d.userAgent);
      const time = d.linkedAt && d.linkedAt._seconds ? new Date(d.linkedAt._seconds * 1000).toLocaleString("ar-EG") : "-";
      return `<tr>
        <td>${d.userName}</td>
        <td>${info.os}</td>
        <td>${info.browser}</td>
        <td>${time}</td>
        <td><button class="btn small danger" onclick="betaResetDevice('${d.userId}')">إعادة تعيين</button></td>
      </tr>`;
    })
    .join("");

  if (devices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--muted);text-align:center;">لا توجد أجهزة مرتبطة بعد.</td></tr>`;
  }
}

window.betaResetDevice = async (userId) => {
  if (!confirm("سيتمكن المستخدم من تسجيل الدخول من جهاز جديد. متابعة؟")) return;
  try {
    await api(`/api/device/reset/${userId}`, { method: "POST" });
    alert("تمت إعادة تعيين الجهاز بنجاح.");
    loadDevices();
  } catch (err) {
    alert("فشلت إعادة تعيين الجهاز: " + err.message);
  }
};

// ------------ التهيئة ------------
(async function init() {
  initTheme();
  initLang();
  currentUser = await guardPage(["owner", "admin"]);
  document.getElementById("welcomeText").textContent = `مرحبًا ${currentUser.fullName} 👋`;
  loadStats();
})();
