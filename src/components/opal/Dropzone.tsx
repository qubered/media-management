"use client";

import { useState } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/opal/types";

export default function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
        dragging ? "border-accent bg-accent/10" : "border-border hover:border-muted"
      }`}
    >
      <span className="text-base font-medium">
        <span className="md:hidden">Select a photo or video</span>
        <span className="hidden md:inline">Drop a photo or video here</span>
      </span>
      <span className="text-xs text-muted">
        <span className="md:hidden">Tap to choose</span>
        <span className="hidden md:inline">or click to choose</span> — auto-converted to {CANVAS_WIDTH}x{CANVAS_HEIGHT}
      </span>
      <input
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
