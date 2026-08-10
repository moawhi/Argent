import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { needsOnboarding } from "@/server/auth/account";
import { requireUser } from "@/server/auth/permissions";

export default async function OnboardingPage() {
  const user = await requireUser({ allowIncompleteOnboarding: true });

  if (!needsOnboarding(user)) {
    redirect("/");
  }

  return (
    <OnboardingWizard
      name={user.name}
      email={user.email}
      mustChangePassword={user.mustChangePassword}
      theme={user.theme}
    />
  );
}
