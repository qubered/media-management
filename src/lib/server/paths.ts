import path from "node:path";

export const DATA_DIR = process.env.OPAL_DATA_DIR
  ? path.resolve(process.env.OPAL_DATA_DIR)
  : path.join(process.cwd(), "data");

export const MEDIA_DIR = path.join(DATA_DIR, "media");
export const DB_PATH = path.join(DATA_DIR, "presets.db");
