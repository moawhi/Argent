"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useServerInsertedHTML } from "next/navigation";
import {
  BRAND_COLOR_STORAGE_KEY,
  THEME_BOOT_SCRIPT,
  THEME_STORAGE_KEY,
  applyBrandColor,
  applyTheme,
  isBrandColor,
  isThemeId,
  readStoredBrandColor,
  type ThemeId,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  brandColor: string | null;
  setBrandColor: (hex: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => undefined,
  brandColor: null,
  setBrandColor: () => undefined,
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Owns the app-wide appearance preference. Persists to localStorage always,
 * and to the signed-in user record when a saver is provided.
 *
 * The FOUC boot script is injected with useServerInsertedHTML so React 19
 * never sees a <script> in the client component tree.
 */
export function ThemeProvider({
  initialTheme = "light",
  persistToServer,
  children,
}: {
  initialTheme?: ThemeId;
  persistToServer?: (theme: ThemeId) => Promise<void>;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);
  const [brandColor, setBrandColorState] = useState<string | null>(null);

  useServerInsertedHTML(() => (
    <script
      id="argent-theme-boot"
      dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
    />
  ));

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored) && stored !== initialTheme) {
      setThemeState(stored);
      applyTheme(stored);
    } else {
      applyTheme(initialTheme);
    }

    const storedBrand = readStoredBrandColor();
    setBrandColorState(storedBrand);
    applyBrandColor(storedBrand);
  }, [initialTheme]);

  useEffect(() => {
    applyTheme(theme);
    // Re-apply brand after theme tokens change so soft/ink mixes stay coherent.
    applyBrandColor(brandColor);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyTheme("system");
      applyBrandColor(brandColor);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, brandColor]);

  const setTheme = useCallback(
    (next: ThemeId) => {
      setThemeState(next);
      applyTheme(next);
      applyBrandColor(brandColor);
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      void persistToServer?.(next);
    },
    [persistToServer, brandColor],
  );

  const setBrandColor = useCallback((hex: string | null) => {
    const next = hex && isBrandColor(hex) ? hex.trim().toLowerCase() : null;
    setBrandColorState(next);
    applyBrandColor(next);
    if (next) {
      window.localStorage.setItem(BRAND_COLOR_STORAGE_KEY, next);
    } else {
      window.localStorage.removeItem(BRAND_COLOR_STORAGE_KEY);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, brandColor, setBrandColor }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
