"use client";

export default function MediaPreview({ previewDataUrl, alt = "Preview" }: { previewDataUrl: string; alt?: string }) {
  return (
    <div className="mx-auto aspect-[9/16] w-40 overflow-hidden rounded-lg border border-border bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={previewDataUrl} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}
