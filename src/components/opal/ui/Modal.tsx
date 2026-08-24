"use client";

/** The standard modal shell — backdrop, panel, header with title + close. See DESIGN.md "Component patterns". */
export default function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-border bg-surface p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="truncate font-display text-xl text-foreground">{title}</h2>
          <button onClick={onClose} className="shrink-0 text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
