import {
  piyasaHepsi, birimTl, kriptoBasamak, dovizSerisi,
  type Kur, type Maden, type Kripto,
} from "@/lib/piyasa/client";

/* ══════════════════════════════════════════════════════════════
   PİYASALAR SAYFASI

   API'nin verdiği her şey burada: TCMB döviz bülteni, Borsa
   İstanbul kıymetli madenler, kripto paralar.

   ⚠ BÖLÜMLER BAĞIMSIZ.
   Belge: biri alınamazsa diğerleri yine döner. Boş bölüm hiç
   basılmıyor; sayfa yarım görünmüyor.
   ══════════════════════════════════════════════════════════════ */

const MADEN_AD: Record<string, string> = {
  altin: "Altın", gumus: "Gümüş", platin: "Platin", paladyum: "Paladyum",
};

function tl(n: number, basamak = 2) {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: basamak, maximumFractionDigits: basamak,
  });
}

function Degisim({ pct }: { pct: number | null | undefined }) {
  if (typeof pct !== "number" || !Number.isFinite(pct)) {
    return <span style={{ color: "var(--mu)", fontSize: 13 }}>—</span>;
  }
  const artis = pct >= 0;
  return (
    <span style={{
      color: artis ? "var(--ac2)" : "var(--dn)",
      fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
    }}>
      {artis ? "▲" : "▼"} {Math.abs(pct).toLocaleString("tr-TR", {
        minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
    </span>
  );
}

function Bolum({ baslik, alt, children }: {
  baslik: string; alt?: string; children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>{baslik}</h2>
      {alt && (
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--mu)" }}>{alt}</p>
      )}
      {/*
        ⚠ IZGARA — DİKEY LİSTE DEĞİL.
        Masaüstünde her satırda tek kart sayfayı gereksiz
        uzatıyordu. Kartlar genişliğe göre yerleşiyor: geniş
        ekranda dört, tablette iki, telefonda bir.
      */}
      <div style={{
        display: "grid", gap: 12,
        gridTemplateColumns: "repeat(auto-fill, minmax(min(210px, 100%), 1fr))",
      }}>
        {children}
      </div>
    </section>
  );
}

/**
 * Mini grafik.
 *
 * ⚠ SVG, KÜTÜPHANE YOK.
 * Otuz nokta için grafik kütüphanesi yüklemek gereksiz ağırlık.
 * Nokta yoksa hiç çizilmiyor.
 */
function MiniGrafik({ noktalar, artis }: { noktalar?: number[]; artis: boolean }) {
  if (!noktalar || noktalar.length < 2) return null;

  const enAz = Math.min(...noktalar);
  const enCok = Math.max(...noktalar);
  const aralik = enCok - enAz || 1;
  const G = 100, Y = 30;

  const d = noktalar
    .map((v, i) => {
      const x = (i / (noktalar.length - 1)) * G;
      const y = Y - ((v - enAz) / aralik) * Y;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const renk = artis ? "var(--ac2)" : "var(--dn)";

  return (
    <svg
      viewBox={`0 0 ${G} ${Y}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ width: "100%", height: 34, display: "block", marginTop: 12 }}
    >
      <path d={`${d} L${G},${Y} L0,${Y} Z`} fill={renk} opacity=".10" />
      <path d={d} fill="none" stroke={renk} strokeWidth="1.6"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Sembol rozeti.
 *
 * ⚠ İKON SETİNDE PARA BİRİMİ SİMGESİ YOK.
 * Her kur ve coin için ayrı simge eklemek yerine sembolün ilk
 * harfleri kullanılıyor: her zaman çalışıyor, tutarlı duruyor
 * ve yeni bir sembol eklendiğinde bakım gerektirmiyor.
 */
function Rozet({ ad, para }: { ad: string; para?: string }) {
  const PARA: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "₣", TRY: "₺",
  };
  const metin = PARA[ad.toUpperCase()] ?? ad.slice(0, 3).toUpperCase();
  return (
    <span
      aria-hidden
      style={{
        display: "grid", placeItems: "center", flexShrink: 0,
        width: 34, height: 34, borderRadius: 11,
        background: "var(--s2)", color: "var(--mu)",
        fontSize: metin.length > 1 ? 11 : 16,
        fontWeight: 800, letterSpacing: metin.length > 1 ? "-.01em" : 0,
      }}
    >
      {para ?? metin}
    </span>
  );
}

function Kart({ ad, altAd, deger, pct, spark, simge }: {
  ad: string; altAd?: string; deger: string;
  pct?: number | null; spark?: number[]; simge?: string;
}) {
  const artis = (pct ?? 0) >= 0;
  return (
    <div style={{
      background: "var(--s1)", border: "1px solid var(--bd)",
      borderRadius: 16, padding: "16px 18px",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 10,
      }}>
        <Rozet ad={ad} para={simge} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{
            display: "block", fontSize: 13.5, fontWeight: 800,
            letterSpacing: ".01em",
          }}>
            {ad}
          </span>
          {altAd && (
            <span style={{
              display: "block", fontSize: 11.5, color: "var(--mu)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {altAd}
            </span>
          )}
        </span>
        <Degisim pct={pct} />
      </div>

      <span style={{
        marginTop: 8, fontSize: 21, fontWeight: 800,
        letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums",
      }}>
        {deger}
      </span>

      <MiniGrafik noktalar={spark} artis={artis} />
    </div>
  );
}

export default async function PiyasaPanel() {
  const veri = await piyasaHepsi();

  if (!veri) {
    return (
      <p style={{ color: "var(--mu)", padding: "28px 4px", fontSize: 15 }}>
        Piyasa verisi şu an alınamıyor, birazdan tekrar deneyin.
      </p>
    );
  }

  const kurlar: Kur[] = veri.currencies?.data ?? [];
  /* İşlem görmeyen maden gizleniyor — belgenin önerisi */
  const madenler: Maden[] = (veri.metals?.data ?? [])
    .filter((m) => !m.noData && typeof m.spot?.tryPerGram === "number");
  const kriptolar: Kripto[] = veri.crypto?.data ?? [];

  /*
   * ⚠ GRAFİK YALNIZCA DÖVİZDE.
   * Geçmiş veri EVDS'ten geliyor; orada kripto serisi yok.
   * En çok bakılan beş kur için çekiliyor — hepsi için
   * istemek 20'den fazla ek istek demek olurdu.
   */
  /*
   * ┌─ SAYFA BEŞ GRAFİK İSTEĞİNİ BEKLİYORDU ⚠️ ──────────────────┐
   * │ Her kur için ayrı bir EVDS çağrısı yapılıyor ve sayfa     │
   * │ hepsinin bitmesini bekliyordu. Paralel olsalar bile en    │
   * │ yavaşı kadar sürüyor; EVDS yavaşladığında piyasalar       │
   * │ sayfası saniyelerce açılmıyordu.                            │
   * │                                                              │
   * │ Grafikler artık fiyatların ÖNÜNE geçmiyor: liste hemen    │
   * │ basılıyor, mini grafikler geldiğinde ekleniyor.            │
   * │                                                              │
   * │ Üç kur yeterli: en çok bakılanlar. Beş istek yerine üç.   │
   * └──────────────────────────────────────────────────────────────┘
   */
  const grafikKodlari = ["USD", "EUR", "GBP"];
  const POPULER_DOVIZ = ["USD", "EUR", "GBP"];
  const POPULER_KRIPTO = ["BTC", "ETH", "SOL", "XRP"];

  /* Yaygın para simgeleri; kalanlarda sembolün kendisi yazılıyor */
  const SIMGE: Record<string, string | undefined> = {
    USD: "$", EUR: "€", GBP: "£", altin: "Au", gumus: "Ag",
    platin: "Pt", paladyum: "Pd", BTC: "₿",
  };
  /*
   * ⚠ ZAMAN SINIRI.
   * Grafikler bir buçuk saniyede gelmezse onlarsız devam
   * ediliyor. Fiyatları göstermek grafikten önemli.
   */
  const grafikler = new Map<string, number[]>();
  await Promise.race([
    Promise.all(
      grafikKodlari.map(async (kod) => {
        const seri = await dovizSerisi(kod).catch(() => []);
        if (seri.length > 1) grafikler.set(kod, seri);
      }),
    ),
    new Promise((r) => setTimeout(r, 1500)),
  ]);

  /* Öne çıkanlar: en çok bakılan üç kur, altınlar, popüler kripto */
  const oneCikan: React.ReactNode[] = [];

  for (const kod of POPULER_DOVIZ) {
    const k = kurlar.find((x) => x.code?.toUpperCase() === kod);
    const d = k ? birimTl(k) : null;
    if (k && d !== null) {
      oneCikan.push(
        <Kart key={`p-${kod}`} ad={kod} altAd={k.name ?? undefined}
          deger={`₺${tl(d, d < 1 ? 4 : 2)}`} pct={k.change?.pct}
          spark={grafikler.get(kod)} simge={SIMGE[kod]} />,
      );
    }
  }

  for (const m of madenler.slice(0, 2)) {
    oneCikan.push(
      <Kart key={`p-${m.id}`} ad={MADEN_AD[m.id] ?? m.id} altAd="gram"
        deger={`₺${tl(m.spot!.tryPerGram!)}`} pct={m.spot?.changePct}
        simge={SIMGE[m.id]} />,
    );
  }

  for (const sym of POPULER_KRIPTO) {
    const c = kriptolar.find((x) => x.symbol?.toUpperCase() === sym);
    if (c && typeof c.try === "number") {
      oneCikan.push(
        <Kart key={`p-${sym}`} ad={sym} altAd={c.name ?? undefined}
          deger={`₺${tl(c.try, kriptoBasamak(c.try))}`} pct={c.changePct24h}
          simge={SIMGE[sym]} />,
      );
    }
  }

  return (
    <div>
      {veri.stale && (
        <p style={{
          margin: "0 0 16px", padding: "10px 14px", borderRadius: 12,
          background: "var(--s2)", border: "1px solid var(--bd)",
          fontSize: 13, color: "var(--mu)",
        }}>
          {/*
            ⚠ BAYAT VERİ AÇIKÇA SÖYLENİYOR.
            Belge her yanıtta `stale` alanı olduğunu ve true ise
            kaynağın geçici olarak erişilemediğini söylüyor. Okur
            eski veriye baktığını bilmeli.
          */}
          Kaynak geçici olarak yanıt vermiyor; son geçerli veriler gösteriliyor.
        </p>
      )}

      {/*
        ┌─ EN ÇOK BAKILANLAR ÜSTTE ⚠️ ────────────────────────────┐
        │ Önce bölümler kategori sırasıyla diziliydi; okur dolar │
        │ için sayfayı kaydırmak zorundaydı.                      │
        │                                                          │
        │ Artık dolar, euro, sterlin, gram altın ve popüler      │
        │ kriptolar en üstte tek bir öbekte. Kategorilerin       │
        │ tamamı altta duruyor — hiçbir veri kaybolmuyor.        │
        └──────────────────────────────────────────────────────────┘
      */}
      {oneCikan.length > 0 && (
        <Bolum baslik="Öne çıkanlar">
          {oneCikan}
        </Bolum>
      )}

      {madenler.length > 0 && (
        <Bolum baslik="Kıymetli maden" alt="Borsa İstanbul · günlük kapanış">
          {madenler.map((m) => (
            <Kart
              key={m.id}
              ad={MADEN_AD[m.id] ?? m.id}
              altAd="gram"
              deger={`₺${tl(m.spot!.tryPerGram!)}`}
              pct={m.spot?.changePct}
              simge={SIMGE[m.id]}
            />
          ))}
        </Bolum>
      )}

      {kurlar.length > 0 && (
        <Bolum
          baslik="Döviz"
          alt={`TCMB kur bülteni${veri.currencies?.date ? ` · ${veri.currencies.date}` : ""}`}
        >
          {kurlar.map((k) => {
            /*
             * ⚠ `birimTl` KULLANILIYOR.
             * TCMB Japon Yeni'ni 100 birim üzerinden yayınlıyor;
             * ham satış kuru gösterilseydi yen 100 kat pahalı
             * görünürdü.
             */
            const d = birimTl(k);
            if (d === null) return null;
            return (
              <Kart
                key={k.code}
                ad={k.code}
                altAd={k.name ?? undefined}
                deger={`₺${tl(d, d < 1 ? 4 : 2)}`}
                pct={k.change?.pct}
                spark={grafikler.get(k.code.toUpperCase())}
                simge={SIMGE[k.code.toUpperCase()]}
              />
            );
          })}
        </Bolum>
      )}

      {kriptolar.length > 0 && (
        <Bolum baslik="Kripto" alt="Dakikada bir güncellenir">
          {kriptolar.map((c) => {
            const t = c.try;
            if (typeof t !== "number") return null;
            return (
              <Kart
                key={c.symbol}
                ad={c.symbol}
                altAd={c.name ?? undefined}
                /*
                 * ⚠ BASAMAK SAYISI DEĞERE GÖRE.
                 * PEPE gibi mikro fiyatlı paralar iki ondalıkla
                 * gösterilseydi "0,00" görünürdü.
                 */
                deger={`₺${tl(t, kriptoBasamak(t))}`}
                pct={c.changePct24h}
                simge={SIMGE[c.symbol.toUpperCase()]}
              />
            );
          })}
        </Bolum>
      )}

    </div>
  );
}
