YAHOO SANS FONT DOSYALARI

Dosyaları bu klasöre AT — ADI ÖNEMLİ DEĞİL.

Site açılışta bu klasörü tarar ve bulduğu her dosya için
@font-face kuralı üretir. Ağırlık dosya adından anlaşılır:

  ...Regular / Rg / Book / (adsız)  → 400
  ...Medium                          → 500
  ...SemiBold / DemiBold             → 600
  ...Bold                            → 700
  ...ExtraBold / UltraBold           → 800
  ...Black / Heavy                   → 900
  ...Light                           → 300
  ...Italic / Oblique                → italik

Desteklenen uzantılar: .woff2  .woff  .ttf  .otf

Şu adlandırmaların hepsi çalışır:
  YahooSans-Regular.ttf
  YahooSans_Rg.otf
  Yahoo Sans Bold.woff2
  yahoosans-semibold.ttf
  YahooSansMedium.ttf

Klasör boşsa site bozulmaz; yazı tipi Inter'e düşer.

--------------------------------------------------------------
WOFF2 ÖNERİSİ

TTF dosyaları büyüktür (~150-300 KB). WOFF2'ye çevirirsen
%40-60 küçülür ve ilk açılış gözle görülür hızlanır:

  npx ttf2woff2 < YahooSans-Regular.ttf > YahooSans-Regular.woff2

Site woff2 varsa onu tercih eder, ayrıca ayar gerekmez.
