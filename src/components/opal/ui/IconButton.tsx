"use client";

/** The standard circular icon-only action button — see DESIGN.md "Component patterns". */
export default function IconButton({
  title,
  onClick,
  hoverClass = "hover:text-accent",
  children,
}: {
  title: string;
  onClick: () => void;
  hoverClass?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover active:scale-90 ${hoverClass}`}
    >
      {children}
    </button>
  );
}
