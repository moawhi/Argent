import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppChrome } from "@/components/layout/AppChrome";
import { HelpDrawerHost } from "@/components/docs/HelpDrawer";
import {
  canAccessSection,
  getSessionUser,
} from "@/server/auth/permissions";
import { APP_SECTIONS } from "@/lib/auth/sections";
import { saveThemeAction } from "@/app/login/actions";
import { resolveTheme } from "@/lib/theme";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/lib/brand";

const landingDisplay = Syne({
  subsets: ["latin"],
  variable: "--font-landing-display",
  display: "swap",
});

const landingBody = Figtree({
  subsets: ["latin"],
  variable: "--font-landing-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  const allowedSections = user
    ? APP_SECTIONS.filter((s) => canAccessSection(user, s))
    : [];
  const themePref = user?.theme ?? "light";
  const themeResolved = resolveTheme(themePref);

  return (
    <html
      lang="en"
      data-theme={themeResolved}
      data-theme-pref={themePref}
      className={`${landingDisplay.variable} ${landingBody.variable}`}
      suppressHydrationWarning
    >
      <body
        className="antialiased font-[family-name:var(--font-landing-body)]"
        suppressHydrationWarning
      >
        <Providers
          initialTheme={themePref}
          persistTheme={user ? saveThemeAction : undefined}
        >
          <AppChrome
            user={
              user
                ? {
                    name: user.name,
                    email: user.email,
                    roleLabel: user.role.label,
                    theme: user.theme,
                  }
                : null
            }
            allowedSections={allowedSections}
          >
            {children}
          </AppChrome>
          <HelpDrawerHost />
        </Providers>
      </body>
    </html>
  );
}
