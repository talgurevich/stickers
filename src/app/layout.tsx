import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import Footer from "./_components/Footer";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "מדבקות וואטסאפ — הדפסה ומשלוח",
  description:
    "הופכים את המדבקות מהוואטסאפ שלך למדבקות אמיתיות, מודפסות ונשלחות אליך הביתה.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Footer />
      </body>
    </html>
  );
}
