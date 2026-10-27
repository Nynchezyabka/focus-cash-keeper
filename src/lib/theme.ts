export type Theme = "light" | "dark" | "system";
const KEY = "berezhny-theme";

export const getTheme = (): Theme => (localStorage.getItem(KEY) as Theme) || "system";

export function applyTheme(t: Theme = getTheme()) {
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1f1c18" : "#f4efe6");
}

export function setTheme(t: Theme) {
  localStorage.setItem(KEY, t);
  applyTheme(t);
}

export function initTheme() {
  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => getTheme() === "system" && applyTheme());
}

/** Runs before paint so the night theme does not flash light on start. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${KEY}")||"system";if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;
