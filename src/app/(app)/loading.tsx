export default function AppLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6">
      <div className="h-8 w-56 rounded-lg bg-[var(--surface-muted)]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-24 rounded-xl bg-[var(--surface-muted)]" />
        <div className="h-24 rounded-xl bg-[var(--surface-muted)]" />
        <div className="h-24 rounded-xl bg-[var(--surface-muted)]" />
        <div className="h-24 rounded-xl bg-[var(--surface-muted)]" />
      </div>
      <div className="h-64 rounded-xl bg-[var(--surface-muted)]" />
    </div>
  );
}
