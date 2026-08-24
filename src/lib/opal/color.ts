export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

/** config.xml's <solidColor> uses .NET-style #AARRGGBB hex (see README) — this app always renders it fully opaque. */
export function rgbHexToArgb(hex: string): string {
  return "#ff" + hex.replace("#", "").toLowerCase();
}
