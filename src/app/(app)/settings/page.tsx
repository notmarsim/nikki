import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { mergeUserPreferences } from "@/modules/settings/registry";
import { getUserSettings } from "@/modules/users/service";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export default async function SettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const settings = await getUserSettings(session.user.id);
  const initialPreferences = mergeUserPreferences(settings?.preferences);

  return (
    <SettingsWorkspace
      initialName={session.user.name}
      initialEmail={session.user.email}
      initialBio={session.user.bio}
      initialTimezone={session.user.timezone}
      initialTheme={session.user.theme}
      initialPreferences={initialPreferences}
    />
  );
}
