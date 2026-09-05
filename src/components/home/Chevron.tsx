import Icon from "@/components/ui/Icon";
import Link from "next/link";

/** Bölüm başlıklarındaki "tümü" oku */
export default function Chevron({ href: url, title }: { href?: string; title?: string }) {
  const icon = <Icon name="chevronRight" size={20} />;
  if (!url) return <span className="chev" title={title}>{icon}</span>;
  return (
    <Link className="chev" href={url} title={title} aria-label={title}>
      {icon}
    </Link>
  );
}
