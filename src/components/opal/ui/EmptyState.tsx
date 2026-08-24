/** The standard dashed-border placeholder for an empty list. Empty states here are actionable where possible — see DESIGN.md. */
export default function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted">{children}</p>
  );
}
