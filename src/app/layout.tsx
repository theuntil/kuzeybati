import type { ReactNode } from "react";
import "./globals.css";

/**
 * Kök layout sadece bir kabuk. Gerçek <html> etiketi ve dil/yön
 * bilgisi [locale]/layout.tsx içinde belirleniyor — çünkü `dir`
 * ve `lang` dile bağlı ve burada henüz dil bilinmiyor.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
