// Hand-drawn SVG "stickers" used as decorative accents on testimonials.
// The kiss-cut effect comes from a white blob/circle background with a
// soft drop shadow; the animal sits inside that blob in solid colors.
// Each component renders at the size given by `size` (default 56).

type StickerProps = { size?: number; tilt?: number };

function StickerWrap({
  children,
  size = 56,
  tilt = 0,
  bg = "white",
}: {
  children: React.ReactNode;
  size?: number;
  tilt?: number;
  bg?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ transform: `rotate(${tilt}deg)`, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))" }}
      aria-hidden
    >
      {/* The white kiss-cut paper background. Slightly inset so the shadow
          shows around the edge of the sticker, like a printed cutout. */}
      <circle cx="32" cy="32" r="29" fill={bg} stroke="white" strokeWidth="2" />
      {children}
    </svg>
  );
}

export function CatSticker({ size = 56, tilt = -6 }: StickerProps) {
  return (
    <StickerWrap size={size} tilt={tilt}>
      <g transform="translate(32 36)">
        {/* Ears — outer orange + inner pink */}
        <polygon points="-15,-12 -10,-22 -4,-10" fill="#f4a261" />
        <polygon points="15,-12 10,-22 4,-10" fill="#f4a261" />
        <polygon points="-12,-13 -10,-19 -7,-12" fill="#e76f51" />
        <polygon points="12,-13 10,-19 7,-12" fill="#e76f51" />
        {/* Face */}
        <ellipse cx="0" cy="2" rx="17" ry="15" fill="#f4a261" />
        {/* Stripes */}
        <path d="M -10 -7 q 2 2 4 0" stroke="#e76f51" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M 10 -7 q -2 2 -4 0" stroke="#e76f51" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* Eyes */}
        <ellipse cx="-6" cy="-1" rx="2.2" ry="3" fill="#1f1f1f" />
        <ellipse cx="6" cy="-1" rx="2.2" ry="3" fill="#1f1f1f" />
        <circle cx="-5.3" cy="-2" r="0.7" fill="white" />
        <circle cx="6.7" cy="-2" r="0.7" fill="white" />
        {/* Nose */}
        <path d="M -2 5 L 2 5 L 0 7 Z" fill="#e76f51" />
        {/* Mouth */}
        <path d="M 0 7 q -2 3 -4 2" stroke="#1f1f1f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M 0 7 q 2 3 4 2" stroke="#1f1f1f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* Whiskers */}
        <line x1="-9" y1="5" x2="-15" y2="4" stroke="#1f1f1f" strokeWidth="0.8" />
        <line x1="-9" y1="7" x2="-15" y2="8" stroke="#1f1f1f" strokeWidth="0.8" />
        <line x1="9" y1="5" x2="15" y2="4" stroke="#1f1f1f" strokeWidth="0.8" />
        <line x1="9" y1="7" x2="15" y2="8" stroke="#1f1f1f" strokeWidth="0.8" />
      </g>
    </StickerWrap>
  );
}

export function FrogSticker({ size = 56, tilt = 4 }: StickerProps) {
  return (
    <StickerWrap size={size} tilt={tilt}>
      <g transform="translate(32 34)">
        {/* Head */}
        <ellipse cx="0" cy="4" rx="20" ry="16" fill="#84cc16" />
        {/* Eye sockets — bulging on top */}
        <circle cx="-9" cy="-10" r="7" fill="#84cc16" />
        <circle cx="9" cy="-10" r="7" fill="#84cc16" />
        {/* Eye whites */}
        <circle cx="-9" cy="-10" r="5" fill="white" />
        <circle cx="9" cy="-10" r="5" fill="white" />
        {/* Pupils */}
        <circle cx="-9" cy="-9" r="2.5" fill="#1f1f1f" />
        <circle cx="9" cy="-9" r="2.5" fill="#1f1f1f" />
        <circle cx="-8" cy="-10" r="0.9" fill="white" />
        <circle cx="10" cy="-10" r="0.9" fill="white" />
        {/* Mouth — wide smile */}
        <path d="M -10 6 Q 0 14 10 6" stroke="#1f1f1f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* Cheek dots */}
        <circle cx="-13" cy="3" r="1.5" fill="#65a30d" opacity="0.6" />
        <circle cx="13" cy="3" r="1.5" fill="#65a30d" opacity="0.6" />
      </g>
    </StickerWrap>
  );
}

export function HenSticker({ size = 56, tilt = -3 }: StickerProps) {
  return (
    <StickerWrap size={size} tilt={tilt}>
      <g transform="translate(32 34)">
        {/* Body */}
        <ellipse cx="0" cy="6" rx="18" ry="14" fill="#fef3c7" stroke="#f59e0b" strokeWidth="0.6" />
        {/* Wing */}
        <ellipse cx="-5" cy="9" rx="9" ry="5" fill="#fde68a" />
        {/* Head */}
        <circle cx="0" cy="-6" r="9" fill="#fef9c3" />
        {/* Comb (red) */}
        <path d="M -4 -14 Q -3 -18 -1 -15 Q 0 -19 2 -15 Q 4 -18 5 -14 Z" fill="#dc2626" />
        {/* Beak */}
        <polygon points="-2,-4 -10,-2 -2,-1" fill="#f59e0b" />
        {/* Wattle */}
        <ellipse cx="-3" cy="0" rx="1.5" ry="2.5" fill="#dc2626" />
        {/* Eye */}
        <circle cx="2" cy="-7" r="1.6" fill="#1f1f1f" />
        <circle cx="2.4" cy="-7.5" r="0.6" fill="white" />
        {/* Feet */}
        <line x1="-4" y1="20" x2="-4" y2="24" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="4" y1="20" x2="4" y2="24" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </StickerWrap>
  );
}

export function OctopusSticker({ size = 56, tilt = 5 }: StickerProps) {
  return (
    <StickerWrap size={size} tilt={tilt}>
      <g transform="translate(32 30)">
        {/* Tentacles — wavy lines from underside */}
        <path d="M -16 8 Q -18 18 -12 22 Q -8 16 -10 8" fill="#a855f7" />
        <path d="M -8 12 Q -10 22 -4 24 Q -2 18 -2 10" fill="#a855f7" />
        <path d="M 0 12 Q 0 24 6 24 Q 8 18 4 10" fill="#a855f7" />
        <path d="M 8 12 Q 10 22 14 22 Q 14 16 12 10" fill="#a855f7" />
        <path d="M 16 8 Q 18 18 18 16 Q 18 12 14 8" fill="#a855f7" />
        {/* Head */}
        <ellipse cx="0" cy="-2" rx="16" ry="14" fill="#c084fc" />
        {/* Eyes */}
        <circle cx="-5" cy="-3" r="3" fill="white" />
        <circle cx="5" cy="-3" r="3" fill="white" />
        <circle cx="-5" cy="-2.5" r="1.6" fill="#1f1f1f" />
        <circle cx="5" cy="-2.5" r="1.6" fill="#1f1f1f" />
        {/* Smile */}
        <path d="M -4 4 Q 0 7 4 4" stroke="#1f1f1f" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        {/* Cheeks */}
        <circle cx="-9" cy="2" r="2" fill="#f0abfc" opacity="0.7" />
        <circle cx="9" cy="2" r="2" fill="#f0abfc" opacity="0.7" />
      </g>
    </StickerWrap>
  );
}

export function DogSticker({ size = 56, tilt = -4 }: StickerProps) {
  return (
    <StickerWrap size={size} tilt={tilt}>
      <g transform="translate(32 34)">
        {/* Floppy ears (darker brown, behind head) */}
        <ellipse cx="-15" cy="-2" rx="6" ry="11" fill="#78350f" />
        <ellipse cx="15" cy="-2" rx="6" ry="11" fill="#78350f" />
        {/* Face */}
        <ellipse cx="0" cy="0" rx="16" ry="14" fill="#d97706" />
        {/* Snout */}
        <ellipse cx="0" cy="6" rx="9" ry="7" fill="#fbbf24" />
        {/* Eyes */}
        <circle cx="-6" cy="-3" r="2" fill="#1f1f1f" />
        <circle cx="6" cy="-3" r="2" fill="#1f1f1f" />
        <circle cx="-5.4" cy="-3.5" r="0.6" fill="white" />
        <circle cx="6.6" cy="-3.5" r="0.6" fill="white" />
        {/* Nose */}
        <ellipse cx="0" cy="4" rx="2.4" ry="1.8" fill="#1f1f1f" />
        {/* Mouth */}
        <path d="M 0 6 L 0 9" stroke="#1f1f1f" strokeWidth="1" />
        <path d="M 0 9 q -2 2 -4 1" stroke="#1f1f1f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M 0 9 q 2 2 4 1" stroke="#1f1f1f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* Tongue peek */}
        <ellipse cx="0" cy="11" rx="1.6" ry="1" fill="#fb7185" />
      </g>
    </StickerWrap>
  );
}

export function DuckSticker({ size = 56, tilt = 6 }: StickerProps) {
  return (
    <StickerWrap size={size} tilt={tilt}>
      <g transform="translate(32 34)">
        {/* Body */}
        <ellipse cx="0" cy="8" rx="18" ry="11" fill="#fde047" />
        {/* Head */}
        <circle cx="-4" cy="-6" r="10" fill="#fde047" />
        {/* Tail tip */}
        <polygon points="14,5 22,2 16,10" fill="#fde047" />
        {/* Wing */}
        <ellipse cx="2" cy="9" rx="8" ry="4.5" fill="#facc15" />
        {/* Beak */}
        <ellipse cx="-13" cy="-5" rx="6" ry="3" fill="#f97316" />
        <path d="M -14 -4 L -10 -3" stroke="#ea580c" strokeWidth="0.6" />
        {/* Eye */}
        <circle cx="-2" cy="-7" r="2" fill="#1f1f1f" />
        <circle cx="-1.4" cy="-7.5" r="0.7" fill="white" />
        {/* Cheek */}
        <circle cx="-4" cy="-3" r="1.6" fill="#fb923c" opacity="0.6" />
      </g>
    </StickerWrap>
  );
}

export const ANIMAL_STICKERS = [
  CatSticker,
  FrogSticker,
  HenSticker,
  OctopusSticker,
  DogSticker,
  DuckSticker,
];
