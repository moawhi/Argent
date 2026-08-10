import { requireUser } from "@/server/auth/permissions";
import { ThemePicker } from "@/components/theme/ThemePicker";

export default async function SettingsPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Appearance applies across the whole app.
        </p>
      </div>

      <section className="card border border-line p-5">
        <ThemePicker />
      </section>
    </div>
  );
}
