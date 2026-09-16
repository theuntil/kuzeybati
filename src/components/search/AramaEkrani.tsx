"use client";
import {
  useCallback, useEffect, useMemo, useRef, useState, useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { href, type Locale } from "@/i18n/config";

/* ══════════════════════════════════════════════════════════════
   ARAMA EKRANI

   Üstte arama kutusu; altında son aramalar, trend aramalar ve
   önerilen haberler.

   ⚠ SON ARAMALAR YALNIZCA TARAYICIDA.
   Sunucuya gönderilmiyor. Kimin ne aradığını saklamak gereksiz
   bir sorumluluk; depolama kapalıysa (gizli sekme) bölüm hiç
   görünmüyor ve hata vermiyor.
   ══════════════════════════════════════════════════════════════ */

const ANAHTAR = "kb-aramalar";
const EN_FAZLA = 8;

/** Kayıtlı aramalar; bozuk veya elle değiştirilmiş içerik elenir */
function gecmisOku(): string[] {
  try {
    const ham = localStorage.getItem(ANAHTAR);
    if (!ham) return [];
    const d: unknown = JSON.parse(ham);
    if (!Array.isArray(d)) return [];

    /*
     * ⚠ HER ÖĞE DENETLENİYOR.
     * `localStorage` kullanıcı tarafından elle değiştirilebilir.
     * İçeriği doğrudan basmak, sayfaya istenmeyen metin sokmanın
     * yolu olurdu.
     */
    return d
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.slice(0, 80).trim())
      .filter(Boolean)
      .slice(0, EN_FAZLA);
  } catch {
    return [];
  }
}

function gecmisYaz(liste: string[]) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(liste.slice(0, EN_FAZLA)));
  } catch { /* depolama kapalı — sorun değil */ }
}

export interface TrendItem { terim: string; artis: number }
export interface OneriItem {
  slug: string; baslik: string; gorsel: string | null;
}

export default function AramaEkrani({
  locale, ilkSorgu, trendler, oneriler, sonucVar,
}: {
  locale: Locale;
  ilkSorgu: string;
  trendler: TrendItem[];
  oneriler: OneriItem[];
  /** Sonuç listesi sunucudan geliyor; doluysa alt bölümler gizleniyor */
  sonucVar: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(ilkSorgu);
  const [gecmis, setGecmis] = useState<string[]>([]);
  const kutu = useRef<HTMLInputElement>(null);

  /*
   * ┌─ ARAMA SIRASINDA ESKİ EKRAN DURUYORDU ⚠️ ──────────────────┐
   * │ Enter'a basıldığında sunucu yeni sonuçları hazırlarken    │
   * │ son aramalar ve trend listesi ekranda kalıyordu. Okur     │
   * │ hiçbir şey olmamış gibi görüyor, aramanın çalışıp         │
   * │ çalışmadığını anlayamıyordu.                                │
   * │                                                              │
   * │ Artık arama başlar başlamaz iskelet basılıyor.             │
   * │ `useTransition` gezinmenin ne zaman bittiğini söylüyor —  │
   * │ zamanlayıcı tahmin olurdu.                                   │
   * └──────────────────────────────────────────────────────────────┘
   */
  const [araniyor, gecisBaslat] = useTransition();

  /*
   * ⚠ SUNUCUDA `localStorage` YOK.
   * İlk çizimde okunursa hidrasyon uyuşmazlığı olur ve React
   * ağacı yeniden çizer. Efekt içinde okunuyor.
   */
  useEffect(() => { setGecmis(gecmisOku()); }, []);

  /* Boş sayfada imleç kutuda: okur hemen yazmaya başlayabilsin */
  useEffect(() => {
    if (!ilkSorgu) kutu.current?.focus();
  }, [ilkSorgu]);

  const ara = useCallback((terim: string) => {
    const temiz = terim.trim().slice(0, 80);

    /*
     * ┌─ BOŞ ARAMA HİÇBİR ŞEY YAPMIYORDU ⚠️ ───────────────────────┐
     * │ Kutu boşken Enter'a basınca fonksiyon sessizce           │
     * │ dönüyordu. Okur sonuç sayfasında takılı kalıyor,          │
     * │ başlangıca dönmenin yolu olmuyordu.                       │
     * │                                                              │
     * │ Artık boş arama başlangıç ekranına götürüyor.             │
     * └──────────────────────────────────────────────────────────────┘
     */
    if (!temiz) {
      if (ilkSorgu) {
        gecisBaslat(() => { router.push(href(locale, "search")); });
      }
      return;
    }

    setGecmis((eski) => {
      /* Aynı terim tekrar aranırsa başa alınıyor, çoğaltılmıyor */
      const yeni = [temiz, ...eski.filter((x) => x !== temiz)].slice(0, EN_FAZLA);
      gecmisYaz(yeni);
      return yeni;
    });

    gecisBaslat(() => {
      router.push(`${href(locale, "search")}?q=${encodeURIComponent(temiz)}`);
    });
  }, [locale, router, ilkSorgu]);

  function sil(terim: string) {
    setGecmis((eski) => {
      const yeni = eski.filter((x) => x !== terim);
      gecmisYaz(yeni);
      return yeni;
    });
  }

  function temizle() {
    setGecmis([]);
    gecmisYaz([]);
  }

  const enBuyukArtis = useMemo(
    () => Math.max(1, ...trendler.map((x) => x.artis)),
    [trendler],
  );

  return (
    <div className="kb-arama">
      <div className="kb-arama-kutu">
        <span className="kb-arama-ikon" aria-hidden>
          <Icon name="search" size={19} strokeWidth={2} />
        </span>
        <input
          ref={kutu}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ara(q); }}
          placeholder="Haber, takım, sembol ara"
          aria-label="Arama"
          enterKeyHint="search"
          maxLength={80}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              kutu.current?.focus();
              /*
               * ⚠ SONUÇ SAYFASINDAYSA GERİ DÖNÜLÜYOR.
               * Yalnızca kutuyu boşaltmak, arkadaki sonuçları
               * ekranda bırakıyordu — okur temizlediğini
               * sanıp aynı listeye bakmaya devam ediyordu.
               */
              if (ilkSorgu) {
                gecisBaslat(() => { router.push(href(locale, "search")); });
              }
            }}
            aria-label="Temizle"
            className="kb-arama-sil"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {/*
        ⚠ SONUÇ VARKEN ALT BÖLÜMLER GİZLİ.
        Okur bir şey aradıysa trend listesi değil sonuçlar
        önemli; ikisini birden basmak sayfayı gürültüye
        boğuyordu.
      */}
      {araniyor ? (
        <AramaIskeleti />
      ) : !sonucVar && (
        <>
          {gecmis.length > 0 && (
            <section className="kb-arama-bolum">
              <div className="kb-arama-baslik">
                <h2>Son aramalar</h2>
                <button type="button" onClick={temizle} className="kb-arama-temizle">
                  Temizle
                </button>
              </div>
              <div className="kb-arama-etiketler">
                {gecmis.map((x) => (
                  <span key={x} className="kb-arama-etiket">
                    <button type="button" onClick={() => ara(x)}>{x}</button>
                    <button
                      type="button"
                      onClick={() => sil(x)}
                      aria-label={`${x} aramasını sil`}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          )}

          {trendler.length > 0 && (
            <section className="kb-arama-bolum">
              <div className="kb-arama-baslik"><h2>Trend aramalar</h2></div>
              <ol className="kb-trend">
                {trendler.map((x, i) => (
                  <li key={x.terim}>
                    <button type="button" onClick={() => ara(x.terim)}>
                      <span className="kb-trend-no">{i + 1}</span>
                      <span className="kb-trend-ad">{x.terim}</span>
                      <span
                        className="kb-trend-artis"
                        /* Artış oranı görsel olarak da ayrışıyor */
                        style={{ opacity: 0.55 + (x.artis / enBuyukArtis) * 0.45 }}
                      >
                        +{x.artis}%
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {oneriler.length > 0 && (
            <section className="kb-arama-bolum">
              <div className="kb-arama-baslik"><h2>Önerilen haberler</h2></div>
              <div className="kb-arama-oneri">
                {oneriler.map((x) => (
                  <Link
                    key={x.slug}
                    href={`${href(locale, "news")}/${x.slug}`}
                    className="kb-oneri-kart"
                  >
                    <span className="kb-oneri-gorsel">
                      {x.gorsel && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={x.gorsel} alt="" loading="lazy" decoding="async" />
                      )}
                    </span>
                    <span className="kb-oneri-baslik">{x.baslik}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ARAMA İSKELETİ

   ⚠ SONUÇ KARTLARIYLA AYNI ÖLÇÜDE.
   Farklı yükseklikte olsaydı sonuçlar gelince sayfa zıplar,
   okur yerini kaybederdi.
   ══════════════════════════════════════════════════════════════ */

function AramaIskeleti() {
  return (
    <div className="kb-arama-bolum" aria-hidden>
      <span
        className="kb-arama-satir"
        style={{ width: 160, height: 20, display: "block", marginBottom: 16 }}
      />
      <div className="kb-arama-oneri">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="kb-oneri-kart">
            <span className="kb-oneri-gorsel kb-arama-satir" />
            <span
              className="kb-arama-satir"
              style={{ height: 14, marginTop: 9, display: "block" }}
            />
            <span
              className="kb-arama-satir"
              style={{ height: 14, width: "65%", marginTop: 6, display: "block" }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
