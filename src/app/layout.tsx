import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import Header from "./_components/Header";
import Footer from "./_components/Footer";
import MobileFirstNotice from "./_components/MobileFirstNotice";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

// Required so relative URLs (including the auto-generated opengraph-image.tsx
// route at /opengraph-image) become absolute in the meta tags. LinkedIn,
// WhatsApp, and iMessage scrapers won't follow relative `og:image` URLs.
const SITE_URL = "https://www.wallaura.art";

const SHARE_TITLE = "Wallaura · הסטיקר ההוא מהוואטסאפ — עכשיו על הקיר";
const SHARE_DESCRIPTION =
  "שולחים תמונה או סטיקר בוואטסאפ. מקבלים מדבקה, מגנט או קעקוע זמני הביתה. בלי אפליקציה, בלי עיצוב.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Wallaura · הדפסה אישית מהוואטסאפ",
  description:
    "התמונות והסטיקרים שלך מהוואטסאפ — מדבקות, מגנטים וקעקועים זמניים. הדפסה ומשלוח עד הבית.",
  openGraph: {
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Wallaura",
    locale: "he_IL",
    type: "website",
    // The actual image comes from src/app/opengraph-image.tsx — Next.js
    // wires it automatically when the file exists in the route segment.
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <MobileFirstNotice />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
