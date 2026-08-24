import { DisplaySettings, MediaAsset } from "./types";

export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Reproduces the exact element/attribute shape of the two sample configs.
 * Field order matches the samples (cosmetic, but kept in case the vendor's
 * parser is order-sensitive).
 */
export function buildConfigXml(
  settings: DisplaySettings,
  asset: MediaAsset,
  imageHashForLanguage: string | undefined,
  graphicsBitmapBase64: string,
): string {
  const levelsCsv = settings.levels.join(",");
  const languagesAttr = `${escapeXmlAttr(settings.defaultLanguage)},`;

  const contentBlock =
    asset.kind === "image"
      ? buildStaticImageBlock(settings, imageHashForLanguage ?? asset.hash, asset.hash)
      : buildVideoFrameBlock(settings, asset.hash);

  return (
    `<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n` +
    `<display revision="2" AppVersion="14.8.1750.0" AllLevels="${levelsCsv}" ActiveLevels="" PassiveLevels="" CommsEnabled="False" BluetoothEnabled="False" Flipped="False" SoundLevel="${settings.soundLevel}" Notes="${escapeXmlAttr(settings.notes)}" TimeZone="${escapeXmlAttr(settings.timeZone)}" PassiveBehaviorStartup="NONE" DemoBehavior="NONE" Languages="${languagesAttr}" DefaultLanguage="${escapeXmlAttr(settings.defaultLanguage)}" x="0" y="0" width="${settings.width}" height="${settings.height}" z="0" inactivity_timeout="0" xmlns="http://www.designcom.com.au/schemas/DisplaySchema">\n` +
    `  <BackgroundAudioFiles BackgroundMusicVolume="0" />\n` +
    `  <DynamicComponents />\n` +
    `  <background>\n` +
    `    <solidColor>${escapeXmlAttr(settings.backgroundColorArgb)}</solidColor>\n` +
    `  </background>\n` +
    contentBlock +
    `  <graphics bitmap="${graphicsBitmapBase64}" xmlns="" />\n` +
    `</display>\n`
  );
}

function buildStaticImageBlock(
  settings: DisplaySettings,
  languageFileHash: string,
  targetFileHash: string,
): string {
  return (
    `  <staticimage EnforceRatio="false" IsLanguageSupported="False" x="0" y="0" width="${settings.width}" height="${settings.height}" z="0">\n` +
    `    <Language LanguageName="${escapeXmlAttr(settings.defaultLanguage)}">\n` +
    `      <Filename>\n` +
    `        <fileRef>${languageFileHash}.png</fileRef>\n` +
    `      </Filename>\n` +
    `    </Language>\n` +
    `    <fileRef targetWidth="${settings.width}" targetHeight="${settings.height}">${targetFileHash}.png</fileRef>\n` +
    `  </staticimage>\n`
  );
}

function buildVideoFrameBlock(settings: DisplaySettings, fileHash: string): string {
  return (
    `  <videoFrame x="0" y="0" width="${settings.width}" height="${settings.height}" z="0" isLoopPlayer="False" isStreamingEnabled="False" isHlsPlayer="False" Volume="0" CycleMinutes="0">\n` +
    `    <fileRef>${fileHash}.mp4</fileRef>\n` +
    `  </videoFrame>\n`
  );
}

export function buildContentTypesXml(extension: "png" | "mp4"): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="${extension}" ContentType="application/octet-stream" />` +
    `<Default Extension="xml" ContentType="text/xml" />` +
    `</Types>`
  );
}
