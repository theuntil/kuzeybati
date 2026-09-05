import type { IconName } from "@/components/ui/Icon";
import type { ServiceKey } from "@/i18n/config";

/* ══════════════════════════════════════════════════════════════
   HİZMET LİSTESİ — TEK KAYNAK

   ┌─ ÜÇ AYRI YERDE ELLE YAZILIYORDU ⚠️ ───────────────────────┐
   │ Masaüstü açılır kutusu, mobil panel ve hizmetler sayfası  │
   │ hizmet listesini kendi içinde tutuyordu. Deprem hizmeti    │
   │ eklendiğinde yalnızca rota ve sözlük güncellendi; üç      │
   │ listeye de eklenmediği için menüde HİÇ GÖRÜNMEDİ.         │
   │                                                              │
   │ ⚠ `Record<ServiceKey, ...>` TİPİ KORUMA SAĞLIYOR.          │
   │ Yeni bir hizmet `serviceSlugs`'a eklenip buraya            │
   │ eklenmezse TypeScript derlemeyi durduruyor — sessizce      │
   │ kaybolamıyor.                                                │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface HizmetGorunum {
  icon: IconName;
  color: string;
  tint: string;
}

export const HIZMET_GORUNUM: Record<ServiceKey, HizmetGorunum> = {
  prayer:     { icon: "mosque",   color: "#30D158",   tint: "rgba(48,209,88,.15)" },
  weather:    { icon: "weather",  color: "var(--ac)", tint: "rgba(179,34,30,.15)" },
  markets:    { icon: "markets",  color: "#0A84FF",   tint: "rgba(10,132,255,.15)" },
  scores:     { icon: "trophy",   color: "#BF5AF2",   tint: "rgba(191,90,242,.15)" },
  traffic:    { icon: "traffic",  color: "#FF9F0A",   tint: "rgba(255,159,10,.15)" },
  pharmacy:   { icon: "pharmacy", color: "#2FD9C4",   tint: "rgba(47,217,196,.15)" },
  earthquake: { icon: "warn",     color: "#FF453A",   tint: "rgba(255,69,58,.15)" },
  onthisday:  { icon: "clock",     color: "#FFD60A",   tint: "rgba(255,214,10,.15)" },
};

/*
 * Menülerde gösterim sırası.
 *
 * ⚠ `Object.keys` KULLANILMIYOR: sıra tanım sırasına bağlı
 * kalırdı ve yeni hizmet eklenince beklenmedik yere düşerdi.
 */
export const HIZMET_SIRA: ServiceKey[] = [
  "weather", "prayer", "earthquake", "markets", "onthisday", "pharmacy", "traffic", "scores",
];
