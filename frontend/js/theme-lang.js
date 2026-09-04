import { translatePage } from "./i18n.js";

const THEME_KEY = "beta_theme";
const LANG_KEY = "beta_lang";

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}

export function initLang() {
  const saved = localStorage.getItem(LANG_KEY) || "ar";
  applyLang(saved);
}

export function applyLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  localStorage.setItem(LANG_KEY, lang);
  const btn = document.getElementById("langToggle");
  if (btn) btn.textContent = lang === "ar" ? "EN" : "AR";
  translatePage(lang);
}

export function toggleLang() {
  const current = localStorage.getItem(LANG_KEY) || "ar";
  applyLang(current === "ar" ? "en" : "ar");
}

window.betaToggleTheme = toggleTheme;
window.betaToggleLang = toggleLang;
