import { getCurrentSession } from "@/modules/auth/session";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Configure your account, appearance, and workspace preferences.
        </p>
      </div>

      <SettingsForm
        initialName={session.user.name}
        initialEmail={session.user.email}
        initialTimezone={session.user.timezone}
        initialTheme={session.user.theme}
      />
    </div>
  );
}
