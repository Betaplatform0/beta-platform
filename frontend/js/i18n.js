export const translations = {
  ar: {
    loginTitle: "تسجيل الدخول",
    loginSub: "أدخل رقم هاتفك وكلمة المرور للمتابعة",
    phoneLabel: "رقم الهاتف",
    passwordLabel: "كلمة المرور",
    loginBtn: "دخول",
    noAccount: "ليس لديك حساب؟",
    signupLink: "سجل حساب جديد الآن",

    signupTitle: "إنشاء حساب جديد",
    signupSub: "سجل بياناتك وسيتم مراجعة حسابك قريبًا",
    fullNameLabel: "الاسم الكامل",
    seatLabel: "رقم الجلوس",
    confirmPasswordLabel: "تأكيد كلمة المرور",
    signupBtn: "تسجيل الحساب",
    haveAccount: "لديك حساب بالفعل؟",
    loginLink: "تسجيل الدخول",

    navHome: "🏠 الصفحة الرئيسية",
    navAccount: "👤 حسابي",
    navLogout: "🚪 تسجيل الخروج",
    backToFolders: "⬅ رجوع للفولدرات",
    welcome: "مرحبًا",

    accFullName: "الاسم الكامل",
    accPhone: "رقم الهاتف",
    accSeat: "رقم الجلوس",
    accRole: "نوع الحساب",
    accStatus: "حالة الحساب",
  },
  en: {
    loginTitle: "Login",
    loginSub: "Enter your phone number and password to continue",
    phoneLabel: "Phone Number",
    passwordLabel: "Password",
    loginBtn: "Login",
    noAccount: "Don't have an account?",
    signupLink: "Sign up now",

    signupTitle: "Create New Account",
    signupSub: "Fill in your details, your account will be reviewed soon",
    fullNameLabel: "Full Name",
    seatLabel: "Seat Number",
    confirmPasswordLabel: "Confirm Password",
    signupBtn: "Create Account",
    haveAccount: "Already have an account?",
    loginLink: "Login",

    navHome: "🏠 Home",
    navAccount: "👤 My Account",
    navLogout: "🚪 Logout",
    backToFolders: "⬅ Back to folders",
    welcome: "Welcome",

    accFullName: "Full Name",
    accPhone: "Phone Number",
    accSeat: "Seat Number",
    accRole: "Account Type",
    accStatus: "Account Status",
  },
};

export function translatePage(lang) {
  const dict = translations[lang] || translations.ar;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.placeholder = dict[key];
  });
}
