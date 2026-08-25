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
      className={`flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover active:scale-90 md:h-7 md:w-7 ${hoverClass}`}
    >
      {children}
    </button>
  );
}
