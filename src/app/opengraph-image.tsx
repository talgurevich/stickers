import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Generated 1200×630 social card (Open Graph + Twitter both reuse this).
// Renders the logo on a brand emerald background with a sticker-stack motif.
// Hebrew text is intentionally kept out of the image — Satori (the renderer
// behind ImageResponse) needs explicit Hebrew font registration which is
// fragile in serverless. The og:title/description carry the Hebrew copy and
// scrapers display them above the image anyway.

export const alt = "Wallaura — stickers, magnets, and temporary tattoos from your WhatsApp photos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoBytes = await readFile(join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logoBytes.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage:
            "linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)",
          fontFamily: "sans-serif",
          color: "white",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Floating "sticker" decorations — colored circles with white kiss-cut
            border, slight tilt, drop shadow. Echoes our actual product. */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 80,
            width: 110,
            height: 110,
            borderRadius: "50%",
            background: "#fbbf24",
            border: "8px solid white",
            transform: "rotate(-12deg)",
            boxShadow: "0 8px 16px rgba(0,0,0,0.25)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 90,
            right: 110,
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: "#f472b6",
            border: "7px solid white",
            transform: "rotate(15deg)",
            boxShadow: "0 8px 16px rgba(0,0,0,0.25)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 120,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "#60a5fa",
            border: "7px solid white",
            transform: "rotate(8deg)",
            boxShadow: "0 8px 16px rgba(0,0,0,0.25)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 110,
            right: 90,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "#a78bfa",
            border: "8px solid white",
            transform: "rotate(-6deg)",
            boxShadow: "0 8px 16px rgba(0,0,0,0.25)",
            display: "flex",
          }}
        />

        {/* Logo — center, with subtle drop shadow */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt=""
          width={780}
          height={254}
          style={{
            filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))",
          }}
        />

        {/* Tagline strip in English so the rendered text doesn't depend on a
            Hebrew font being available to Satori at edge runtime. */}
        <div
          style={{
            marginTop: 40,
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: "0.02em",
            display: "flex",
          }}
        >
          STICKERS · MAGNETS · TATTOOS — FROM WHATSAPP
        </div>

        <div
          style={{
            marginTop: 16,
            fontSize: 24,
            color: "rgba(255,255,255,0.85)",
            display: "flex",
          }}
        >
          wallaura.art
        </div>
      </div>
    ),
    { ...size },
  );
}
