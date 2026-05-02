import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import Header from "./_components/Header";
import Footer from "./_components/Footer";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wallaura · הדפסה אישית מהוואטסאפ",
  description:
    "התמונות והסטיקרים שלך מהוואטסאפ — מדבקות, מגנטים וטטו זמני. הדפסה ומשלוח עד הבית.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
