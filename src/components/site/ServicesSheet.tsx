"use client";
import Sheet from "./Sheet";
import { HIZMET_GORUNUM, HIZMET_SIRA } from "./hizmetler";
import Icon, { type IconName } from "@/components/ui/Icon";
import { serviceHref, type Locale, type ServiceKey } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Link from "next/link";

/**
 * Hizmetler paneli — prototipteki 3 sütunlu kare ızgara.
 * Header'daki ızgara düğmesi SAYFAYA GİTMEZ, bu paneli açar.
 */
/*
 * ⚠ LİSTE ARTIK ELLE YAZILMIYOR.
 * `hizmetler.ts` tek kaynak; yeni hizmet eklenince burada
 * unutulup menüden kaybolamıyor (deprem tam da bu yüzden
 * görünmüyordu).
 */
const SERVICES = HIZMET_SIRA.map((key) => ({ key, ...HIZMET_GORUNUM[key] }));

export default function ServicesSheet({
  open, onClose, locale, dict, acikHizmetler,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  dict: Dictionary;
  /*
   * Panelden açık olan hizmetler. Verilmezse hepsi gösteriliyor
   * — bileşen ayarı bilmek zorunda kalmasın diye.
   */
  acikHizmetler?: Record<string, boolean>;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={dict.nav.services} height="56%">
      <div
        style={{
          display: "grid", gridTemplateColumns: "repeat(3,1fr)",
          gap: 10, alignContent: "start",
        }}
      >
        {SERVICES.filter((s) => acikHizmetler?.[s.key] !== false).map((s) => (
          <Link
            key={s.key}
            href={serviceHref(locale, s.key)}
            onClick={onClose}
            style={{
              aspectRatio: "1/1", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
              background: "var(--s2)", borderRadius: 16, color: "var(--tx)",
            }}
          >
            <span
              style={{
                width: 52, height: 52, borderRadius: 14,
                background: s.tint, color: s.color,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name={s.icon} size={24} />
            </span>
            <span
              style={{
                fontSize: 13.5, fontWeight: 700, textAlign: "center", padding: "0 6px",
              }}
            >
              {dict.srv[s.key]}
            </span>
          </Link>
        ))}
      </div>
    </Sheet>
  );
}
