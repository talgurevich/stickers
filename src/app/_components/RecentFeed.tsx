"use client";

import { useEffect, useState } from "react";

type FeedItem = {
  id: string;
  thumbUrl: string;
  size: string;
  createdAt: string;
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "עכשיו";
  if (min < 60) return `לפני ${min} ד'`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `לפני ${hr} שעות`;
  const day = Math.round(hr / 24);
  return `לפני ${day} ימים`;
}

export default function RecentFeed() {
  const [items, setItems] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/recent", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { items?: FeedItem[] } | null) => {
        if (alive && j?.items) setItems(j.items);
      })
      .catch(() => {
        /* silent — feed is decorative, not critical */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="relative z-10 mt-12 w-full">
      <h2 className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-white/80 drop-shadow">
        הודפסו לאחרונה
      </h2>
      <ul className="mx-auto grid max-w-3xl grid-cols-4 gap-2 sm:grid-cols-6">
        {items.map((item) => (
          <li
            key={item.id}
            className="group relative overflow-hidden rounded-lg border border-white/30 bg-white/10 backdrop-blur-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.thumbUrl}
              alt=""
              loading="lazy"
              className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="text-[10px] text-white/90" dir="rtl">
                {timeAgo(item.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
