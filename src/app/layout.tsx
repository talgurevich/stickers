import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
