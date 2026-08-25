"use client";

import { useEffect, useRef, useState } from "react";

/** The standard modal shell — backdrop, panel, header with title + close. See DESIGN.md "Component patterns".
 * Below `md` it renders as a swipe-to-dismiss bottom sheet (drag the handle down to close); at `md` and up
 * it's the original centered dialog. Every caller gets both for free — no prop changes needed. */
export default function Modal({
  onClose,
  title,
  maxWidthClassName = "max-w-md",
  children,
}: {
  onClose: () => void;
  title: React.ReactNode;
  maxWidthClassName?: string;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartYRef = useRef(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartYRef.current = e.clientY;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragY(Math.max(0, e.clientY - dragStartYRef.current));
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragY > 100) onClose();
    else setDragY(0);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/70 transition-opacity duration-300 md:items-center md:p-4 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`flex max-h-[92dvh] w-full ${maxWidthClassName} flex-col gap-4 rounded-t-3xl border border-border bg-surface pt-3 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.6)] md:max-h-[85vh] md:rounded-3xl md:pt-6 ${
          dragging ? "" : "transition-transform duration-300 ease-out"
        } ${shown ? "translate-y-0" : "translate-y-full md:translate-y-0"}`}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto h-1.5 w-10 shrink-0 touch-none rounded-full bg-border md:hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        <div className="flex items-center justify-between gap-3 px-6">
          <h2 className="truncate font-display text-xl text-foreground">{title}</h2>
          <button onClick={onClose} className="shrink-0 text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
