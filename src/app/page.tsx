import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { AppHome } from "@/components/home/AppHome";
import { needsOnboarding } from "@/server/auth/account";
import { getSessionUser } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) return <LandingPage />;
  if (needsOnboarding(user)) redirect("/onboarding");
  return <AppHome user={user} />;
}
