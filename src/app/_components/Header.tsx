"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  // The homepage already has a big logo in its hero — skip the header there.
  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 px-4 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/" aria-label="Wallaura — דף הבית" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Wallaura"
            width={529}
            height={172}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>
        <Link
          href="/account"
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
        >
          החשבון שלי
        </Link>
      </div>
    </header>
  );
}
