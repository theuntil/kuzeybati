"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/* ══════════════════════════════════════════════════════════════
   REKLAM ŞERİDİ

   Masaüstünde sayfanın iki yanındaki boşlukta dikey sütun.
   Kaç reklam varsa döngü hâlinde yukarıdan aşağı akıyor.

   ┌─ MOBİLDE HİÇ BASILMIYOR ⚠️ ────────────────────────────────┐
   │ Dar ekranda yan boşluk yok. Bu bileşen CSS ile gizlense    │
   │ bile görseller yine indirilir ve mobil veriyi harcardı.    │
   │ Bu yüzden ekran genişliği ölçülüp bileşen hiç             │
   │ çizilmiyor.                                                  │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface Reklam {
  id: string;
  gorsel_key: string;
  hedef_url: string;
}

/*
 * ⚠ EŞİK CSS İLE AYNI OLMALI.
 * İçerik (1320) + iki şerit (320) + boşluklar. Altında dikey
 * sütun sığmıyor; o durumda yatay şerit basılıyor.
 */
/*
 * ⚠ CSS'TEKİ EŞİKLE AYNI OLMALI.
 * Farklı olursa bir aralıkta ikisi birden ya da hiçbiri
 * görünür. 1180: içerik %70'i kullanıyor, kalan boşlukta
 * dikey sütun sığıyor.
 */
const ESIK = 1180;

export default function ReklamSeridi({
  taraf, cdnBase, aktif = true, yatay = false,
}: {
  taraf: "sol" | "sag";
  cdnBase: string;
  /*
   * ⚠ ANAHTAR SUNUCUDAN GELİYOR.
   * Bileşen kendisi ayarı çekseydi her sayfada fazladan bir
   * istek olurdu; layout ayarları zaten okuyor.
   */
  aktif?: boolean;
  /*
   * ⚠ YATAY MOD.
   * Dar ekranda dikey sütun yok; aynı reklamlar sayfanın
   * üstünde soldan sağa akan tek bir şeritte gösteriliyor.
   * Bu modda `taraf` yok sayılıyor.
   */
  yatay?: boolean;
}) {
  const [liste, setListe] = useState<Reklam[]>([]);
  const [genis, setGenis] = useState(false);
  const [durdu, setDurdu] = useState(false);

  /*
   * ┌─ ŞERİT İKİ KEZ YÜKLENİYOR GİBİ GÖRÜNÜYORDU ⚠️ ─────────────┐
   * │ Görseller `loading="lazy"` ile basılıyordu. Şerit sürekli │
   * │ kaydığı için tarayıcı görselleri TEK TEK, görüş alanına   │
   * │ girdikçe indiriyordu. Ekranda önce boş kutular, sonra     │
   * │ dolan görseller — okur bunu "yükleniyor, sonra tekrar     │
   * │ yükleniyor" diye görüyordu.                                 │
   * │                                                              │
   * │ Artık benzersiz görseller ÖNCEDEN yükleniyor; şerit       │
   * │ ancak hepsi hazır olduğunda basılıyor. Reklam sayısı az   │
   * │ olduğu için bu birkaç dosya demek.                          │
   * └──────────────────────────────────────────────────────────────┘
   */
  const [hazir, setHazir] = useState(false);

  const cdn = cdnBase.replace(/\/+$/, "");
  const kap = useRef<HTMLDivElement>(null);
  /* Veri bir kez çekiliyor; ölçüm değişse de tekrar istenmiyor */
  const cekildi = useRef(false);


  /*
   * ⚠ ÖLÇÜM İLK ÇİZİMDEN SONRA.
   * Sunucuda pencere yok; ilk çizimde okunmaya çalışılırsa
   * hidrasyon uyuşmazlığı olur.
   */
  /*
   * ┌─ ŞERİT ÜST ÜSTE YÜKLENİYORDU ⚠️ ───────────────────────────┐
   * │ `resize` her tetiklendiğinde `setGenis` çağrılıyordu —     │
   * │ değer aynı olsa bile. Mobilde adres çubuğu gizlenip       │
   * │ göründükçe `resize` sürekli tetikleniyor; her seferinde   │
   * │ bileşen yeniden çiziliyor ve görseller yeniden            │
   * │ yükleniyormuş gibi görünüyordu.                             │
   * │                                                              │
   * │ İki koruma:                                                  │
   * │  1. Değer GERÇEKTEN değiştiyse durum güncelleniyor         │
   * │  2. Veri bir kez çekiliyor; sonraki ölçümler yeni istek    │
   * │     açmıyor                                                  │
   * └──────────────────────────────────────────────────────────────┘
   */
  useEffect(() => {
    const olc = () => {
      const yeni = window.innerWidth >= ESIK;
      setGenis((eski) => (eski === yeni ? eski : yeni));
    };
    olc();
    window.addEventListener("resize", olc);
    return () => window.removeEventListener("resize", olc);
  }, []);


  useEffect(() => {
    /*
     * İstek yalnızca gösterilecekse atılıyor:
     *   dikey mod  → geniş ekran
     *   yatay mod  → dar ekran
     */
    if (!aktif) return;
    if (yatay ? genis : !genis) return;
    if (cekildi.current) return;

    cekildi.current = true;
    let iptal = false;
    void (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("public_reklamlar")
        .select("id, gorsel_key, hedef_url")
        .eq("yer", "rail")
        .order("sira");

      if (iptal) return;
      if (error) {
        /* Reklam sayfanın olmazsa olmazı değil */
        console.error("[REKLAM] şerit okunamadı:", error.message);
        return;
      }
      const gelen = (data ?? []) as Reklam[];
      setListe(gelen);

      if (gelen.length === 0) { setHazir(true); return; }

      /*
       * ⚠ HATA DA "HAZIR" SAYILIYOR.
       * Bir görsel yüklenemezse şerit sonsuza kadar gizli
       * kalmamalı; o kutu boş görünür ama diğerleri çalışır.
       */
      let kalan = gelen.length;
      const bitti = () => {
        kalan -= 1;
        if (kalan <= 0 && !iptal) setHazir(true);
      };

      for (const r of gelen) {
        const im = new Image();
        im.onload = bitti;
        im.onerror = bitti;
        im.src = `${cdn}/${r.gorsel_key}`;
      }
    })();

    return () => { iptal = true; };
  }, [genis, aktif, yatay, cdn]);

  if (!aktif || !hazir || liste.length === 0) return null;
  if (yatay ? genis : !genis) return null;

  /*
   * ┌─ SÜTUN İLK AÇILIŞTA BOŞTU ⚠️ ──────────────────────────────┐
   * │ Kopya sayısı 8 öğeye göre hesaplanıyordu. Tek reklamda    │
   * │ 8 kopya çıkıyor ama her biri ~130 piksel; toplam 1000     │
   * │ piksel. Ekran daha uzunsa altta boşluk kalıyor ve sütun   │
   * │ "yukarıdan dolarak" başlıyormuş gibi görünüyordu.         │
   * │                                                              │
   * │ Artık hedef 24 öğe: iki ekran boyu içerik. Kaydırma       │
   * │ yarıya geldiğinde başa dönüyor ve sütun HER AN dolu       │
   * │ kalıyor.                                                     │
   * └──────────────────────────────────────────────────────────────┘
   */
  const kopya = Math.max(2, Math.ceil(24 / liste.length));
  const oge = Array.from({ length: kopya }, () => liste).flat();

  /*
   * Hız içerik uzunluğuyla orantılı: kaç reklam olursa olsun
   * okuma hızı sabit. 5.5 sn/öğe — öncekinden bir tık hızlı.
   */
  const sure = liste.length * kopya * 5.5;

  const tikla = (id: string) => {
    /* Sayaç beklenmiyor: tıklama gecikmemeli */
    void supabaseBrowser()
      .rpc("reklam_tiklandi", { p_id: id })
      .then(() => undefined, () => undefined);
  };

  if (yatay) {
    return (
      <div className="kb-reklam-yatay" aria-label="Reklam">
        <div
          className="kb-reklam-yatay-akis"
          style={{
            animationDuration: `${sure}s`,
            animationPlayState: durdu ? "paused" : "running",
          }}
          onMouseEnter={() => setDurdu(true)}
          onMouseLeave={() => setDurdu(false)}
        >
          {oge.map((r, i) => (
            <a
              key={`${r.id}-${i}`}
              href={r.hedef_url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="kb-reklam-yatay-oge"
              onClick={() => tikla(r.id)}
            >
              {/*
                ⚠ `lazy` DEĞİL.
                Görseller zaten önceden indirildi ve önbellekte;
                `lazy` burada yalnızca gecikme yaratırdı.
              */}
              <img src={`${cdn}/${r.gorsel_key}`} alt="" decoding="async" />
            </a>
          ))}
        </div>
      </div>
    );
  }


  return (
    <aside
      ref={kap}
      className={`kb-reklam-serit kb-reklam-${taraf}`}
      aria-label="Reklam"
      onMouseEnter={() => setDurdu(true)}
      onMouseLeave={() => setDurdu(false)}
    >
      <div
        className="kb-reklam-akis"
        style={{
          animationDuration: `${sure}s`,
          /* İmleç üstteyken akış duruyor — okur inceleyebilsin */
          animationPlayState: durdu ? "paused" : "running",
        }}
      >
        {oge.map((r, i) => (
          <a
            key={`${r.id}-${i}`}
            href={r.hedef_url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="kb-reklam-oge"
            onClick={() => tikla(r.id)}
          >
            <img
              src={`${cdn}/${r.gorsel_key}`}
              alt=""
              decoding="async"
            />
          </a>
        ))}
      </div>
    </aside>
  );
}
