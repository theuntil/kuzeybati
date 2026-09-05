"use client";
import { useState, type FormEvent } from "react";
import CeviriPenceresi, { type Ceviri } from "./CeviriPenceresi";
import EtiketGirisi from "./EtiketGirisi";
import OnayPenceresi from "@/components/ui/OnayPenceresi";
import { supabaseBrowser } from "@/lib/supabase/client";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { CityOption } from "@/components/site/CitySheet";
import { useToast } from "@/components/ui/Toast";
import Icon from "@/components/ui/Icon";
import MediaUploader, { type MediaItem } from "./MediaUploader";
import Link from "next/link";

export interface CategoryOption { slug: string; name: string }

export interface Block { type: "paragraph" | "heading"; text: string }

export interface EditorArticle {
  id: string;
  cover_url?: string | null;
  editor_media?: MediaItem[] | null;
  title: string;
  summary: string | null;
  body: Block[];
  category_slug: string | null;
  city_slug: string | null;
  tags: string[] | null;
  status: string;
}

/**
 * HABER EDİTÖRÜ
 *
 * Gövde HAM HTML DEĞİL, blok dizisi: `{type, text}`. Veritabanı
 * da bu biçimi bekliyor (`articles.body` jsonb). Ham HTML kabul
 * etmek XSS kapısı açardı; blok yapısı hem güvenli hem de mobil
 * uygulamada aynı veriden farklı düzen üretmeye elverişli.
 *
 * Kaydetme `editor_create_article` / `editor_update_article`
 * RPC'leri üzerinden: kategori doğrulaması, sahiplik kontrolü ve
 * onay akışı veritabanında. İstemciyi atlatan biri bunları da
 * atlayamaz.
 */
export default function ArticleEditor({
  locale, dict, categories, cities, article,
}: {
  locale: Locale;
  dict: Dictionary;
  categories: CategoryOption[];
  cities: CityOption[];
  /** Düzenleme modunda dolu, yeni haberde undefined */
  article?: EditorArticle;
}) {
  const editing = Boolean(article);
  const t = useToast();

  const [title, setTitle] = useState(article?.title ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [blocks, setBlocks] = useState<Block[]>(
    article?.body?.length ? article.body : [{ type: "paragraph", text: "" }],
  );
  const [category, setCategory] = useState(article?.category_slug ?? categories[0]?.slug ?? "");
  const [city, setCity] = useState(article?.city_slug ?? "");
  /*
   * ⚠ DİZİ OLARAK TUTULUYOR, VİRGÜLLÜ METİN DEĞİL.
   * `EtiketGirisi` rozet tabanlı çalışıyor; metin parçalama
   * işi tek bir yere (o bileşene) taşındı.
   */
  const [tags, setTags] = useState<string[]>(article?.tags ?? []);
  const [cover, setCover] = useState<string | null>(article?.cover_url ?? null);
  const [media, setMedia] = useState<MediaItem[]>(article?.editor_media ?? []);
  const [busy, setBusy] = useState(false);
  /*
   * ⚠ HABERİN DİLİ.
   *
   * Yazar İngilizce bir haber yazdığında bu, var olan Türkçe
   * haberin ÇEVİRİSİ olarak kaydedilmeli — ayrı bir haber
   * olarak değil. Yoksa aynı olay listelerde iki kez çıkar.
   *
   * Boş bırakılırsa haber normal (Türkçe) kaydediliyor.
   */
  const [yaziDili, setYaziDili] = useState<"" | "en" | "ar" | "ru">("");

  /*
   * ⚠ YENİ HABERDE DE ÇEVİRİ EKLENEBİLİYOR — PROFESYONEL ÇÖZÜM.
   *
   * Kural değişmiyor: Türkçe hâlâ zorunlu ve hâlâ ana alanlar
   * (title/summary/blocks) üzerinden giriliyor. Ama artık yazar
   * "bu haberi başka dilde de ekle" düğmesine basıp AYRI bir
   * PENCEREDE o dilde yazabiliyor.
   *
   * Kaydetme iki adımda oluyor: önce Türkçe haber oluşturuluyor
   * (editor_create_article), sonra dönen id ile çeviri kaydediliyor
   * (editor_ceviri_kaydet). Türkçe alanlar boşsa zaten ilk adımda
   * "Başlık zorunlu" hatası çıkıyor — yapısal olarak Türkçesiz
   * yabancı dil eklemek mümkün değil.
   */
  const [ceviriPencere, setCeviriPencere] = useState(false);
  const [ceviri, setCeviri] = useState<Ceviri | null>(null);
  /* Haberi silme onayı */
  const [silOnay, setSilOnay] = useState(false);
  const [siliniyor, setSiliniyor] = useState(false);

  async function haberiSil() {
    if (!article) return;
    setSiliniyor(true);
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("editor_delete_article", { p_id: article.id });
    setSiliniyor(false);
    if (error) { setErr(error.message); return; }
    window.location.href = `${href(locale, "account")}?tab=articles`;
  }
  const [err, setErr] = useState<string | null>(null);

  function setBlock(i: number, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }
  function addBlock(type: Block["type"]) {
    setBlocks((prev) => [...prev, { type, text: "" }]);
  }
  function removeBlock(i: number) {
    setBlocks((prev) => (prev.length === 1 ? prev : prev.filter((_, j) => j !== i)));
  }
  function move(i: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!title.trim()) { setErr(dict.editor.needTitle); return; }
    if (!category) { setErr(dict.editor.needCategory); return; }

    const clean = blocks
      .map((b) => ({ type: b.type, text: b.text.trim() }))
      .filter((b) => b.text.length > 0);
    if (clean.length === 0) { setErr(dict.editor.needBody); return; }

    setBusy(true);
    const sb = supabaseBrowser();
    const payload = {
      p_title: title.trim(),
      p_summary: summary.trim() || null,
      p_body: clean,
      p_category: category,
      p_city: city || null,
      p_tags: tags,
      p_cover_url: cover,
      p_media: media,
    };

    /*
     * Dil seçildiyse haber çeviri olarak kaydediliyor.
     * Bunun için var olan bir haber gerekiyor — yeni haberde
     * dil seçimi yalnızca düzenlemede anlamlı.
     */
    if (yaziDili && editing) {
      const { error: cErr } = await sb.rpc("editor_ceviri_kaydet", {
        p: {
          article_id: article!.id,
          locale: yaziDili,
          baslik: title.trim(),
          ozet: summary.trim() || null,
          icerik: clean.map((b) => b.text ?? "").filter(Boolean).join("\n\n"),
        },
      });
      setBusy(false);
      if (cErr) { setErr(cErr.message); return; }
      window.location.href = `${href(locale, "account")}?tab=articles`;
      return;
    }

    const { data, error } = editing
      ? await sb.rpc("editor_update_article", { p_id: article!.id, ...payload })
      : await sb.rpc("editor_create_article", payload);

    if (error) { setBusy(false); setErr(error.message); return; }

    /*
     * ⚠ YENİ HABERDE ÇEVİRİ İKİNCİ ADIM.
     * Türkçe haber az önce oluşturuldu; dönen id ile çeviri
     * kaydediliyor. Bu adım başarısız olsa bile ana haber zaten
     * kaydedilmiş durumda — akışı durdurmuyoruz, yalnızca
     * uyarıyoruz.
     */
    if (!editing && ceviri) {
      const yeniId = (data as { id?: string } | null)?.id;
      if (yeniId) {
        const { error: cErr } = await sb.rpc("editor_ceviri_kaydet", {
          p: {
            article_id: yeniId,
            locale: ceviri.dil,
            baslik: ceviri.baslik,
            ozet: ceviri.ozet || null,
            icerik: ceviri.icerik,
          },
        });
        if (cErr) {
          t.error("Haber kaydedildi ama çevirisi eklenemedi — sonra tekrar dene");
        }
      }
    }

    setBusy(false);

    /*
     * ⚠ SONUÇ BİLDİRİLİYOR.
     *
     * Kaydettikten sonra sessizce yönlendiriliyordu; yazar
     * haberinin yayınlanıp yayınlanmadığını bilmiyordu.
     * Durum adres çentiğiyle taşınıyor ve haberlerim
     * sayfasında toast olarak gösteriliyor.
     */
    const sonuc = (data as { bekliyor?: boolean } | null)?.bekliyor
      ? "beklemede"
      : editing ? "guncellendi" : "yayinlandi";

    window.location.href =
      `${href(locale, "account")}?tab=articles#kb=${sonuc}`;
  }

  const label: React.CSSProperties = { display: "block", marginBottom: 6 };

  return (
    /*
     * ⚠ MASAÜSTÜNDE İKİ SÜTUN.
     *
     * Form tek sütun dikey diziliyordu; geniş ekranda sağ taraf
     * bomboş kalıyor, yazar sürekli aşağı kaydırmak zorunda
     * kalıyordu. Sol sütun içerik (başlık, özet, gövde), sağ
     * sütun künye (kategori, şehir, etiket, kapak).
     */
    <>
    <CeviriPenceresi
      acik={ceviriPencere}
      baslangic={ceviri}
      onKapat={() => setCeviriPencere(false)}
      onKaydet={setCeviri}
    />
    <OnayPenceresi
      acik={silOnay}
      baslik="Haberi sil"
      aciklama="Bu haberi silmek istediğine emin misin? Bu işlem geri alınamaz."
      onayYazi={siliniyor ? "…" : "Sil"}
      onIptal={() => setSilOnay(false)}
      onOnay={() => { setSilOnay(false); void haberiSil(); }}
    />
    <form onSubmit={submit} className="kb-editor" style={{ display: "grid", gap: 16 }}>
      {editing && article!.status === "published" && (
        <p
          className="kb-tam"
          style={{display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center",
            margin: 0, padding: "12px 14px", borderRadius: 14,
            background: "rgba(255,159,10,.12)", color: "#FF9F0A",
            fontSize: 13.5, lineHeight: 1.5, fontWeight: 600,
          }}
        >
          {dict.editor.willUnpublish}
        </p>
      )}

      {/*
        ⚠ İKİ GERÇEK SARMALAYICI — TEK GRID SATIRI YOK.

        Önce her alan (`kb-ana`/`kb-yan`) formun doğrudan çocuğu
        olarak DOM sırasına göre CSS grid'e diziliyordu. Grid
        otomatik yerleştirme kısa alanları (başlık) ve uzun
        alanları (kapak yükleyici) AYNI satıra düşürüyor, satır
        yüksekliği en uzun öğeye göre büyüyor, başlıkla özet
        arasında dev bir boşluk oluşuyordu.

        Artık sol ve sağ sütun İKİ AYRI kapsayıcı: her biri
        kendi içeriği kadar uzuyor, birbirini etkilemiyor.
      */}
      <div className="kb-ana" style={{ display: "grid", gap: 16, alignContent: "start" }}>
      <label>
        <span className="eyebrow muted" style={label}>{dict.editor.title}</span>
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          required
          style={{ height: 52, fontSize: 16, fontWeight: 600 }}
        />
      </label>

      <label>
        <span className="eyebrow muted" style={label}>{dict.editor.summary}</span>
        <textarea
          className="field"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          maxLength={500}
          style={{ resize: "vertical", minHeight: 64, fontSize: 15 }}
        />
      </label>

      {/* ---- gövde blokları ---- */}
      <div>
        <span className="eyebrow muted" style={label}>{dict.editor.body}</span>
        <div style={{ display: "grid", gap: 10 }}>
          {blocks.map((b, i) => (
            <div
              key={i}
              style={{
                background: "var(--s1)", border: "1px solid var(--bd)",
                borderRadius: 14, padding: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em",
                    textTransform: "uppercase", color: "var(--mu)",
                  }}
                >
                  {b.type === "heading" ? dict.editor.heading : dict.editor.paragraph}
                </span>

                <span style={{ display: "flex", gap: 4, marginInlineStart: "auto" }}>
                  <IconBtn label="↑" onClick={() => move(i, -1)} disabled={i === 0} icon="chevronLeft" rotate />
                  <IconBtn label="↓" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} icon="chevronRight" rotate />
                  <IconBtn
                    label={dict.common.delete}
                    onClick={() => removeBlock(i)}
                    disabled={blocks.length === 1}
                    icon="close"
                    danger
                  />
                </span>
              </div>

              <textarea
                className="field"
                value={b.text}
                onChange={(e) => setBlock(i, { text: e.target.value })}
                rows={b.type === "heading" ? 1 : 4}
                placeholder={b.type === "heading" ? dict.editor.heading : dict.editor.paragraph}
                style={{
                  resize: "vertical",
                  minHeight: b.type === "heading" ? 48 : 96,
                  fontSize: b.type === "heading" ? 17 : 15,
                  fontWeight: b.type === "heading" ? 700 : 400,
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => addBlock("paragraph")}
            style={addBtn}
          >
            <Icon name="news" size={14} />
            {dict.editor.addParagraph}
          </button>
          <button
            type="button"
            onClick={() => addBlock("heading")}
            style={addBtn}
          >
            <Icon name="chevronRight" size={14} />
            {dict.editor.addHeading}
          </button>
        </div>
      </div>
      </div>

      {/*
        SAĞ SÜTUN — künye.

        ⚠ SARMALAYICI GEREKLİ (MediaUploader bir bileşen,
        `className` doğrudan geçilemiyor).
      */}
      <div className="kb-yan" style={{ display: "grid", gap: 16, alignContent: "start" }}>
      <div>
        <MediaUploader
          items={media}
          onChange={setMedia}
          cover={cover}
          onCoverChange={setCover}
          dict={dict}
        />
      </div>

      {/*
        HABERİN DİLİ

        ⚠ İKİ FARKLI DAVRANIŞ — DÜZENLEME VE YENİ HABER.

        Düzenlerken: dropdown ANA alanların (başlık/özet/gövde)
        hangi dile ait olduğunu değiştiriyor — var olan davranış,
        dokunulmadı.

        Yeni haberde: ana alanlar HER ZAMAN Türkçe. Başka dilde
        de eklemek istersen ayrı, İKİNCİ bir alan seti açılıyor.
        Kaydederken önce Türkçe haber oluşuyor, sonra o haberin
        çevirisi olarak bu ikinci set kaydediliyor. Türkçe alanlar
        boşsa zaten ilk adımda hata veriyor — yapısal olarak
        Türkçesiz yabancı dil eklemek mümkün değil.
      */}
      {editing ? (
        <label>
          <span className="eyebrow muted" style={label}>Yazının dili</span>
          <select
            className="field"
            value={yaziDili}
            onChange={(e) => setYaziDili(e.target.value as "" | "en" | "ar" | "ru")}
            style={{ height: 52, fontSize: 16 }}
          >
            <option value="">Türkçe — haberin kendisi</option>
            <option value="en">İngilizce çevirisi</option>
            <option value="ar">Arapça çevirisi</option>
            <option value="ru">Rusça çevirisi</option>
          </select>
          <span style={{ display: "block", marginTop: 6, fontSize: 12.5, lineHeight: 1.5, color: "var(--mu)" }}>
            {yaziDili
              ? "Yazdıkların bu haberin seçtiğin dildeki sürümü olarak kaydedilir. Türkçe aslı değişmez."
              : "Yazdıkların haberin kendisini günceller."}
          </span>
        </label>
      ) : (
        <div style={{
          border: "1px solid var(--bd)", borderRadius: 14, padding: 14,
          background: "var(--s2)",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            Başka dilde de ekle
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--mu)", margin: "0 0 12px" }}>
            {ceviri
              ? "Kaydedince önce Türkçe haber, sonra bu çeviri eklenir."
              : "İsteğe bağlı. Türkçe alanları boş bırakamazsın."}
          </p>

          {ceviri ? (
            /*
              Eklenmiş çeviri özeti — pencereyi tekrar açmadan
              ne eklendiği görünüyor.
            */
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "11px 12px", borderRadius: 12,
              background: "var(--s1)", border: "1px solid var(--bd)",
            }}>
              <span style={{ fontSize: 19, lineHeight: 1 }} aria-hidden>
                {ceviri.dil === "en" ? "🇬🇧" : ceviri.dil === "ar" ? "🇸🇦" : "🇷🇺"}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: "block", fontSize: 13.5, fontWeight: 700,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {ceviri.baslik}
                </span>
                <span style={{ display: "block", fontSize: 12, color: "var(--mu)" }}>
                  {ceviri.dil === "en" ? "İngilizce" : ceviri.dil === "ar" ? "Arapça" : "Rusça"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setCeviriPencere(true)}
                className="kb-ikon-btn"
                title="Düzenle" aria-label="Çeviriyi düzenle"
                style={{ width: 32, height: 32 }}
              >
                <Icon name="pencil" size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCeviri(null)}
                className="kb-ikon-btn kb-ikon-sil"
                title="Kaldır" aria-label="Çeviriyi kaldır"
                style={{ width: 32, height: 32 }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCeviriPencere(true)}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                gap: 8, width: "100%", height: 46, borderRadius: 12,
                border: "1px dashed var(--bd)", background: "transparent",
                color: "var(--tx)", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              <Icon name="plus" size={16} />
              Çeviri ekle
            </button>
          )}
        </div>
      )}

      <div className="kb-kunye" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 180px", minWidth: 0 }}>
          <span className="eyebrow muted" style={label}>{dict.editor.category}</span>
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            style={{ height: 52, fontSize: 16 }}
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>

        <label style={{ flex: "1 1 180px", minWidth: 0 }}>
          <span className="eyebrow muted" style={label}>{dict.srv.province}</span>
          <select
            className="field"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{ height: 52, fontSize: 16 }}
          >
            <option value="">{dict.editor.noCity}</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="eyebrow muted" style={label}>{dict.editor.tags}</span>
        <EtiketGirisi value={tags} onChange={setTags} />
      </div>
      </div>


      {err && (
        <p
          className="kb-tam"
          role="alert"
          style={{
            margin: 0, padding: "11px 14px", borderRadius: 12,
            background: "rgba(229,72,77,.12)", color: "#E5484D", fontSize: 13.5,
          }}
        >
          {err}
        </p>
      )}

      <div className="kb-tam" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/*
          Silme — yalnızca düzenlemede ve yalnızca ikon.
          Yazılı "Sil" düğmesi kaydetme düğmesiyle aynı ağırlıkta
          duruyor ve yanlışlıkla basılmaya davetiye çıkarıyordu.
        */}
        {editing && (
          <button
            type="button"
            onClick={() => setSilOnay(true)}
            className="kb-ikon-btn kb-ikon-sil"
            title="Haberi sil"
            aria-label="Haberi sil"
            style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0 }}
          >
            <Icon name="trash" size={17} />
          </button>
        )}
        <Link
          href={`${href(locale, "account")}?tab=articles`}
          style={{
            flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center",
            height: 52, padding: "0 22px", borderRadius: 14,
            background: "var(--s2)", color: "var(--tx)", fontSize: 15, fontWeight: 700,
          }}
        >
          {dict.common.back}
        </Link>
        <button
          type="submit"
          disabled={busy}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flex: 1, height: 52, borderRadius: 14,
            background: "var(--tx)", color: "var(--bg)",
            fontSize: 16, fontWeight: 700, opacity: busy ? 0.65 : 1,
            border: "none", cursor: "pointer",
          }}
        >
          {busy ? dict.common.loading : dict.editor.submitForReview}
        </button>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--mu)", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
        {dict.editor.reviewNote}
      </p>
    </form>
    </>
  );
}

const addBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "10px 16px", borderRadius: 14,
  background: "var(--s2)", color: "var(--tx)",
  fontSize: 13.5, fontWeight: 700,
};

function IconBtn({
  label, onClick, disabled, icon, danger, rotate,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: "chevronLeft" | "chevronRight" | "close";
  danger?: boolean;
  rotate?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: 28, height: 28, borderRadius: 8,
        background: "var(--s2)",
        color: danger ? "var(--dn)" : "var(--mu)",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <span style={{ display: "flex", transform: rotate ? "rotate(90deg)" : undefined }}>
        <Icon name={icon} size={13} strokeWidth={2} />
      </span>
    </button>
  );
}