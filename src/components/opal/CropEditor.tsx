"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CropRect, MediaKind } from "@/lib/opal/types";

const TARGET_ASPECT = 9 / 16;
const MAX_ZOOM = 4;
const DEFAULT_BACKGROUND = "#000000";

interface NaturalSize {
  width: number;
  height: number;
}

interface Fraction {
  width: number;
  height: number;
}

/** Largest 9:16 box (as a fraction of the source) that exactly fills the source at zoom=1 with no
 * padding — this is exactly the vendor's old auto-cover behavior. Zooming below 1 shrinks the source
 * relative to this box, revealing background on whichever axis has slack (an ordinary "contain" fit
 * once zoom reaches minZoom, where both axes fit with no cropping at all).
 */
function coverFraction(source: NaturalSize): Fraction {
  const sourceAspect = source.width / source.height;
  if (sourceAspect > TARGET_ASPECT) {
    return { width: TARGET_ASPECT / sourceAspect, height: 1 };
  }
  return { width: 1, height: sourceAspect / TARGET_ASPECT };
}

function clampAxis(value: number, frac: number): number {
  if (frac >= 1) return 0.5; // whole axis already visible with room to spare — nothing to pan
  return Math.min(Math.max(value, frac / 2), 1 - frac / 2);
}

export default function CropEditor({
  file,
  kind,
  initialCrop,
  initialBackgroundColor,
  onConfirm,
  onCancel,
}: {
  file: File;
  kind: MediaKind;
  initialCrop?: CropRect;
  initialBackgroundColor?: string;
  onConfirm: (crop: CropRect, backgroundColor: string) => void;
  onCancel: () => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<NaturalSize | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [backgroundColor, setBackgroundColor] = useState(initialBackgroundColor ?? DEFAULT_BACKGROUND);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startCenter: { x: number; y: number } } | null>(
    null,
  );
  const seededRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(260);
  const viewportHeight = Math.round(viewportWidth / TARGET_ASPECT);

  // Sizes the crop box to fill however much width its own wrapper actually has (bounded by the
  // wrapper's max-w class) rather than a fixed 260px — bigger, edge-to-edge on a phone, unchanged
  // shape of the math below since everything derives from this instead of a constant.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setViewportWidth(Math.round(width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleMediaLoaded = (size: NaturalSize) => {
    setNatural(size);
    if (seededRef.current) return;
    seededRef.current = true;
    if (initialCrop && initialCrop.width > 0 && initialCrop.height > 0) {
      const cover = coverFraction(size);
      const minZ = Math.min(cover.width, cover.height);
      const z = Math.min(Math.max(cover.width / initialCrop.width, minZ), MAX_ZOOM);
      setZoom(z);
      setCenter({ x: initialCrop.x + initialCrop.width / 2, y: initialCrop.y + initialCrop.height / 2 });
    }
  };

  useEffect(() => {
    // Deliberately created and revoked together inside one effect (rather than a lazy useState
    // initializer) so the pairing survives React Strict Mode's dev-only double-invoke of effects —
    // with a lazy initializer, the synthetic cleanup revokes the URL with nothing left to recreate it.
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const coverFrac = useMemo(() => (natural ? coverFraction(natural) : null), [natural]);
  const minZoom = useMemo(() => (coverFrac ? Math.min(coverFrac.width, coverFrac.height) : 1), [coverFrac]);

  const cropFrac = useMemo(() => {
    if (!coverFrac) return null;
    return { width: coverFrac.width / zoom, height: coverFrac.height / zoom };
  }, [coverFrac, zoom]);

  const clampCenter = (c: { x: number; y: number }, frac: Fraction) => ({
    x: clampAxis(c.x, frac.width),
    y: clampAxis(c.y, frac.height),
  });

  const handleZoomChange = (z: number) => {
    setZoom(z);
    if (!coverFrac) return;
    const frac = { width: coverFrac.width / z, height: coverFrac.height / z };
    setCenter((c) => clampCenter(c, frac));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startCenter: center };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !natural || !cropFrac) return;
    const displayScale = viewportWidth / (cropFrac.width * natural.width);
    const dxFrac = -(e.clientX - drag.startX) / (natural.width * displayScale);
    const dyFrac = -(e.clientY - drag.startY) / (natural.height * displayScale);
    setCenter(clampCenter({ x: drag.startCenter.x + dxFrac, y: drag.startCenter.y + dyFrac }, cropFrac));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  const handleConfirm = () => {
    if (!cropFrac) return;
    onConfirm(
      {
        x: center.x - cropFrac.width / 2,
        y: center.y - cropFrac.height / 2,
        width: cropFrac.width,
        height: cropFrac.height,
      },
      backgroundColor,
    );
  };

  const mediaStyle = (): React.CSSProperties => {
    if (!natural || !cropFrac) return { display: "none" };
    const displayScale = viewportWidth / (cropFrac.width * natural.width);
    return {
      position: "absolute",
      width: natural.width * displayScale,
      height: natural.height * displayScale,
      left: viewportWidth / 2 - center.x * natural.width * displayScale,
      top: viewportHeight / 2 - center.y * natural.height * displayScale,
      maxWidth: "none",
    };
  };

  return (
    <div className="flex flex-col gap-4">
      <div ref={wrapperRef} className="mx-auto w-full max-w-[320px]">
        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-lg border border-border"
          style={{ width: viewportWidth, height: viewportHeight, backgroundColor }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {objectUrl &&
            (kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
                alt="Crop preview"
                draggable={false}
                style={mediaStyle()}
                onLoad={(e) => handleMediaLoaded({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
              />
            ) : (
              <video
                src={objectUrl}
                muted
                loop
                autoPlay
                playsInline
                style={mediaStyle()}
                onLoadedMetadata={(e) => handleMediaLoaded({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight })}
              />
            ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Zoom
          <input
            type="range"
            min={minZoom}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col items-center gap-1 text-sm">
          Background
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="h-8 w-10 rounded border border-border bg-transparent"
          />
        </label>
      </div>

      <p className="text-center text-xs text-muted">
        Drag to reposition, zoom out past full-bleed to letterbox with the background color
      </p>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-hover">
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={!cropFrac}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        >
          Use this crop
        </button>
      </div>
    </div>
  );
}
