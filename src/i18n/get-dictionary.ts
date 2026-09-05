import "server-only";
import type { Locale } from "./config";

/**
 * Sözlükler dinamik import edilir: bir dilin metinleri diğer
 * dillerin bundle'ına girmez.
 */
const loaders = {
  tr: () => import("./dictionaries/tr.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  ar: () => import("./dictionaries/ar.json").then((m) => m.default),
  ru: () => import("./dictionaries/ru.json").then((m) => m.default),
} as const;

export type Dictionary = Awaited<ReturnType<(typeof loaders)["tr"]>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return (await loaders[locale]()) as Dictionary;
}
