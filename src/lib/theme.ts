import { useEffect, useState } from "react"

export type Theme = "system" | "light" | "dark"

export const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("recallbox-theme")
      return saved === "light" || saved === "dark" ? saved : "system"
    } catch {
      return "system"
    }
  })

  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && system.matches)
      document.documentElement.classList.toggle("dark", dark)
      document.documentElement.style.colorScheme = dark ? "dark" : "light"
    }
    apply()
    if (theme === "system") system.addEventListener("change", apply)
    try {
      localStorage.setItem("recallbox-theme", theme)
    } catch {
      // The selected theme still works when browser storage is unavailable.
    }
    return () => system.removeEventListener("change", apply)
  }, [theme])

  return { theme, setTheme }
}
