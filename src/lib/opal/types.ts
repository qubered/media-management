export type MediaKind = "image" | "video";

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;

export interface DisplaySettings {
  width: number;
  height: number;
  timeZone: string;
  soundLevel: number;
  /** #AARRGGBB, matching the .NET-style hex color found in the vendor samples */
  backgroundColorArgb: string;
  levels: number[];
  notes: string;
  defaultLanguage: string;
}

export function defaultSettings(): DisplaySettings {
  return {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    soundLevel: 100,
    backgroundColorArgb: "#ff000000",
    levels: Array.from({ length: 12 }, (_, i) => i + 1),
    notes: "",
    defaultLanguage: "English",
  };
}

/** A crop window expressed as fractions (0..1) of the source media's natural width/height, always at a 9:16 aspect ratio. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MediaAsset {
  kind: MediaKind;
  hash: string;
  extension: "png" | "mp4";
}

/** What the client sees over the API — never includes raw media bytes, those stay server-side. */
export interface PresetSummary {
  id: string;
  name: string;
  kind: MediaKind;
  extension: "png" | "mp4";
  previewDataUrl: string;
  createdAt: number;
  /** #RRGGBB, for re-populating the crop editor's color picker when editing */
  backgroundColorRgb: string;
  /** The crop last used to produce this preset, if known — absent for presets made before editing existed, or created via the API without one. */
  crop?: CropRect;
  /** Present only when the original upload is still available server-side, i.e. this preset can be re-edited. */
  editable: boolean;
  pinned: boolean;
}

/** A physical lectern display registered on the venue network, as a send target. */
export interface LecternDevice {
  id: string;
  name: string;
  host: string;
  createdAt: number;
}

export interface SendResult {
  deviceId: string;
  ok: boolean;
  message: string;
}
