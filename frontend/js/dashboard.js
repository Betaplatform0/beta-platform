import { guardPage } from "./auth-guard.js";
import { BACKEND_URL } from "./firebase-config.js";

let currentUser = null;
let foldersCache = [];

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

// ------------ تبديل التبويبات ------------
document.querySelectorAll(".nav-item[data-tab]").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item[data-tab]").forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    document.querySelectorAll("main > section").forEach((s) => (s.style.display = "none"));
    document.getElementById(`tab-${item.dataset.tab}`).style.display = "block";
    if (item.dataset.tab === "accounts") loadAccounts();
    if (item.dataset.tab === "folders") loadFolders();
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
  await api(`/api/admin/accounts/${id}`, { method: "DELETE" });
  loadAccounts();
};

// ------------ الفولدرات ------------
async function loadFolders() {
  const { folders } = await api("/api/admin/folders");
  foldersCache = folders;
  const grid = document.getElementById("folderGrid");
  grid.innerHTML = folders
    .map(
      (f) => `<div class="folder-card">
        <div class="icon">📁</div>
        <div>${f.name}</div>
        <div style="margin-top:10px;display:flex;gap:6px;justify-content:center;">
          <button class="btn small secondary" onclick="betaRenameFolder('${f.id}','${f.name.replace(/'/g, "\\'")}')">تعديل</button>
          <button class="btn small danger" onclick="betaDeleteFolder('${f.id}')">حذف</button>
        </div>
      </div>`
    )
    .join("");
}

document.getElementById("addFolderBtn").addEventListener("click", async () => {
  const input = document.getElementById("newFolderName");
  if (!input.value.trim()) return;
  await api("/api/admin/folders", { method: "POST", body: JSON.stringify({ name: input.value.trim() }) });
  input.value = "";
  loadFolders();
});

window.betaRenameFolder = async (id, oldName) => {
  const name = prompt("الاسم الجديد للفولدر:", oldName);
  if (!name || !name.trim()) return;
  await api(`/api/admin/folders/${id}`, { method: "PUT", body: JSON.stringify({ name: name.trim() }) });
  loadFolders();
};
window.betaDeleteFolder = async (id) => {
  if (!confirm("سيتم حذف الفولدر وكل الملفات بداخله. متابعة؟")) return;
  await api(`/api/admin/folders/${id}`, { method: "DELETE" });
  loadFolders();
};

// ------------ الملفات ------------
async function loadFilesTab() {
  if (foldersCache.length === 0) await loadFolders();
  const select = document.getElementById("uploadFolderSelect");
  select.innerHTML = foldersCache.map((f) => `<option value="${f.id}">${f.name}</option>`).join("");
  if (foldersCache[0]) loadFilesForFolder(foldersCache[0].id);
  select.addEventListener("change", () => loadFilesForFolder(select.value));
}

async function loadFilesForFolder(folderId) {
  const list = document.getElementById("filesList");
  list.innerHTML = "جارٍ التحميل...";
  const res = await fetch(`${BACKEND_URL}/api/files/by-folder/${folderId}`, {
    headers: { Authorization: `Bearer ${currentUser.idToken}` },
  });
  const data = await res.json();
  list.innerHTML = (data.files || [])
    .map((f) => `<div class="file-row"><span>📄 ${f.displayName}</span><span>${(f.sizeBytes / 1024 / 1024).toFixed(2)} MB</span></div>`)
    .join("") || "<p style='color:var(--muted)'>لا توجد ملفات بعد.</p>";
}

document.getElementById("uploadBtn").addEventListener("click", async () => {
  const folderId = document.getElementById("uploadFolderSelect").value;
  const fileInput = document.getElementById("uploadFileInput");
  const msg = document.getElementById("uploadMsg");
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

// ------------ الصلاحيات ------------
async function loadPermissionsTab() {
  if (foldersCache.length === 0) await loadFolders();
  const { accounts } = await api("/api/admin/accounts");
  const students = accounts.filter((a) => a.role === "student");
  const select = document.getElementById("permStudentSelect");
  select.innerHTML = students.map((s) => `<option value="${s.id}">${s.fullName} (${s.phone})</option>`).join("");

  async function renderPerms() {
    const studentId = select.value;
    if (!studentId) return;
    const { allowedFolders } = await api(`/api/admin/permissions/${studentId}`);
    const container = document.getElementById("permFoldersList");
    container.innerHTML = foldersCache
      .map(
        (f) => `<label style="display:flex;align-items:center;gap:8px;padding:8px 0;">
          <input type="checkbox" value="${f.id}" ${allowedFolders.includes(f.id) ? "checked" : ""} />
          ${f.name}
        </label>`
      )
      .join("");
  }

  select.addEventListener("change", renderPerms);
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

// ------------ الأجهزة ------------
async function loadDevices() {
  const { devices } = await api("/api/admin/devices");
  const tbody = document.getElementById("devicesTable");
  tbody.innerHTML = devices
    .map(
      (d) => `<tr>
        <td>${d.userId}</td>
        <td style="font-size:0.75rem;">${d.deviceId}</td>
        <td>${d.linkedAt ? new Date(d.linkedAt._seconds * 1000).toLocaleString("ar-EG") : "-"}</td>
        <td><button class="btn small danger" onclick="betaResetDevice('${d.userId}')">إعادة تعيين</button></td>
      </tr>`
    )
    .join("");
}

window.betaResetDevice = async (userId) => {
  if (!confirm("سيتمكن المستخدم من تسجيل الدخول من جهاز جديد. متابعة؟")) return;
  await api(`/api/device/reset/${userId}`, { method: "POST" });
  loadDevices();
};

// ------------ التهيئة ------------
(async function init() {
  currentUser = await guardPage(["owner", "admin"]);
  document.getElementById("welcomeText").textContent = `مرحبًا ${currentUser.fullName} 👋`;
  loadStats();
})();
