/**
 * Tema VE yazı boyutu, ilk boyama ÖNCESİNDE uygulanmalı. React
 * hydration'ı beklersek koyu temayı seçmiş kullanıcı bir kare
 * beyaz ekran görür; yazı boyutu da bir kare zıplar. Bu yüzden
 * senkron inline script.
 *
 * ⚠ ASIL SAVUNMA ARTIK ÇEREZ.
 * Sunucu `kb-theme` çerezini okuyup `<html data-theme>` olarak
 * ilk bayta gömüyor (bkz. [locale]/layout.tsx). Bu script iki
 * durumda devrede:
 *   • çerezi olmayan ilk ziyaretçi — sistem tercihinden seçiyor
 *   • çerez ile localStorage ayrışmışsa — çerezi tazeliyor
 *
 * Sunucu zaten doğru attribute'ü koyduysa burada hiçbir şey
 * değişmiyor; yeniden boyama olmuyor.
 */
const script = `
(function () {
  try {
    var el = document.documentElement;
    var sunucu = el.getAttribute('data-theme');
    var saved = localStorage.getItem('kb-theme');
    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = saved || sunucu || (prefersLight ? 'light' : 'dark');

    if (theme !== sunucu) el.setAttribute('data-theme', theme);

    /*
     * Çerez tazeleniyor: sonraki sayfa yüklemesinde sunucu
     * doğru temayı ilk bayta gömebilsin. Bir yıl, site kökü.
     */
    document.cookie = 'kb-theme=' + theme + ';path=/;max-age=31536000;samesite=lax';

    var read = localStorage.getItem('kb-read');
    if (read === 's' || read === 'm' || read === 'l' || read === 'xl') {
      el.setAttribute('data-read', read);
    }
  } catch (e) {
    if (!document.documentElement.getAttribute('data-theme')) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }
})();
`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
