import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon, Search01Icon, Menu01Icon, Moon02Icon, Sun03Icon,
  GridViewIcon, Video01Icon, UserIcon, Login03Icon, Cancel01Icon,
  Delete02Icon,
  PlayCircle02Icon,
  ArrowRight01Icon, ArrowLeft01Icon, FavouriteIcon, Share08Icon,
  Bookmark02Icon, Comment01Icon, EyeIcon, PlayIcon, Time04Icon,
  Mosque01Icon, Sun01Icon, Car03Icon, ChampionIcon, Medicine01Icon,
  Alert02Icon, Location01Icon, Globe02Icon, ArrowDown01Icon,
  Analytics01Icon, News01Icon, VolumeHighIcon, SparklesIcon,
  // Profil
  PencilEdit02Icon, Camera01Icon, Settings02Icon, Tick02Icon, CheckmarkCircle02Icon, Alert01Icon,
  // Eczane / şehir
  Call02Icon, Navigation03Icon, PlusSignCircleIcon, PlusSignIcon, City03Icon, Search02Icon,
  // Akış görünümü
  ListViewIcon, Layout01Icon,
  // Video oynatıcı
  PauseIcon, FullScreenIcon, ArrowShrink02Icon,
  VolumeHighIcon as VolHighIcon, VolumeLowIcon, VolumeMute02Icon,
  PictureInPicture01Icon, Cancel02Icon,
  // Hava durumu (WMO kodlarına eşlenir)
  Sun02Icon, SunCloud01Icon, CloudIcon, CloudFogIcon, CloudDrizzleIcon,
  CloudAngledRainIcon, CloudSnowIcon, CloudBigRainIcon, CloudLittleSnowIcon,
  CloudAngledZapIcon,
} from "@hugeicons/core-free-icons";

/**
 * İKON KATMANI
 *
 * Tüm ikonlar HugeIcons'tan (hugeicons.com) gelir; bileşenlerde
 * elle SVG yazılmaz. Böylece kalınlık, boyut ve stil tek yerden
 * yönetilir ve ikon değiştirmek tek satırlık iş olur.
 *
 * Prototipteki çizgi kalınlığı 1.6–1.8 arasındaydı; varsayılan
 * 1.6 onunla eşleşiyor.
 */
export const icons = {
  home: Home01Icon,
  search: Search01Icon,
  menu: Menu01Icon,
  moon: Moon02Icon,
  sun: Sun03Icon,
  grid: GridViewIcon,
  video: Video01Icon,
  user: UserIcon,
  login: Login03Icon,
  close: Cancel01Icon,
  /*
   * Çöp kutusu. Silme düğmelerinde çarpı kullanılıyordu ama
   * çarpı "kapat" demek; kullanıcı yorumu sildiğini anlamıyordu.
   */
  trash: Delete02Icon,
  /*
   * Reels sekmesi.
   *
   * Düz "video" ikonu ızgara sayfasında kullanılıyor; akış
   * sayfası için oynatma çemberi ayrımı daha net yapıyor.
   */
  reels: PlayCircle02Icon,
  /* İstatistik sayfası bağlantısı */
  chart: Analytics01Icon,
  chevronRight: ArrowRight01Icon,
  chevronLeft: ArrowLeft01Icon,
  heart: FavouriteIcon,
  share: Share08Icon,
  bookmark: Bookmark02Icon,
  comment: Comment01Icon,
  eye: EyeIcon,
  play: PlayIcon,
  clock: Time04Icon,
  mosque: Mosque01Icon,
  weather: Sun01Icon,
  traffic: Car03Icon,
  trophy: ChampionIcon,
  pharmacy: PlusSignCircleIcon,
  quake: Alert02Icon,
  pin: Location01Icon,
  globe: Globe02Icon,
  chevronDown: ArrowDown01Icon,
  markets: Analytics01Icon,
  news: News01Icon,
  speaker: VolumeHighIcon,
  sparkles: SparklesIcon,

  /*
   * ⚠ ÖNCE `Camera01Icon` İDİ.
   * "Düzenle" düğmelerinin hepsi kamera simgesi gösteriyordu —
   * kütüphanede kalem ikonu içe aktarılmamış, birisi geçici
   * olarak kamerayı koymuş ve unutulmuş. `PencilEdit02Icon`
   * gerçek kalem çizimi.
   */
  pencil: PencilEdit02Icon,
  /*
   * Fotoğraf değiştirme rozeti için — "pencil"den ayrı.
   * Kamera, profil/kapak fotoğrafı değiştirmenin evrensel
   * simgesi; düzenleme eylemiyle karıştırılmamalı.
   */
  camera: Camera01Icon,
  /* Ayarlar sekmesi — önce güneş (tema) ikonu kullanılıyordu */
  settings: Settings02Icon,
  check: Tick02Icon,
  verified: CheckmarkCircle02Icon,
  warn: Alert01Icon,

  phone: Call02Icon,
  cross: PlusSignCircleIcon,
  plus: PlusSignIcon,
  city: City03Icon,
  searchAlt: Search02Icon,
  route: Navigation03Icon,

  viewList: ListViewIcon,
  viewCard: Layout01Icon,

  // ---- video oynatıcı ----
  pause: PauseIcon,
  fullscreen: FullScreenIcon,
  fullscreenExit: ArrowShrink02Icon,
  volumeHigh: VolHighIcon,
  volumeLow: VolumeLowIcon,
  volumeMute: VolumeMute02Icon,
  pip: PictureInPicture01Icon,
  closeSmall: Cancel02Icon,

  // ---- hava durumu ----
  wClear: Sun02Icon,
  wPartly: SunCloud01Icon,
  wCloudy: CloudIcon,
  wFog: CloudFogIcon,
  wDrizzle: CloudDrizzleIcon,
  wRain: CloudAngledRainIcon,
  wSnow: CloudSnowIcon,
  wShower: CloudBigRainIcon,
  wSnowShower: CloudLittleSnowIcon,
  wStorm: CloudAngledZapIcon,
} as const;

export type IconName = keyof typeof icons;

export default function Icon({
  name, size = 18, dolu = false, strokeWidth = 1.6, className, color,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /**
   * İçi dolu çizim.
   *
   * Beğenilen kalp ve kaydedilen yer imi dolu görünmeli;
   * yalnızca renk değiştirmek "seçili" hissi vermiyordu.
   */
  dolu?: boolean;
  className?: string;
  color?: string;
}) {
  /*
   * ⚠ `dolu` PARAMETRE OLARAK ALINIYORDU AMA KULLANILMIYORDU.
   *
   * `fill` hiç geçirilmediği için beğenilen kalp ve kaydedilen
   * yer imi boş çizim olarak kalıyordu — yalnızca rengi
   * değişiyordu ve "seçili" hissi vermiyordu.
   *
   * Kütüphanede her ikonun dolu sürümü yok; `fill` vererek
   * aynı ikondan dolu görünüm elde ediliyor. Bu ikinci bir
   * ikon paketi eklemekten çok daha hafif.
   */
  const cizim = icons[name];
  if (!cizim) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Icon] bilinmeyen ikon: ${String(name)}`);
    }
    return <span style={{ display: "inline-block", width: size, height: size }} />;
  }

  return (
    <HugeiconsIcon
      icon={cizim}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      color={color ?? "currentColor"}
      fill={dolu ? "currentColor" : "none"}
    />
  );
}
