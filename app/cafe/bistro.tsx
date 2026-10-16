// Hand-drawn bistro furniture and drink vessels, as inline SVG.
//
// These are our own components, not model output, so inline SVG is safe
// here — unlike works.svg_source, which is sanitised and rendered through
// a data: URI.
//
// Drawn to match the risograph reference: a bentwood chair in green with a
// tan caned seat, a hand-cut pink oval tabletop on a turned pedestal, and
// line-art vessels in a single ink. The café keeps this warm palette
// rather than the gallery's red-and-black on purpose — it is a different
// room, and it should feel like one.

export const CAFE_INKS = {
  paper: "#FBF8F1",
  green: "#3F7A3A",
  pink: "#F2B8C1",
  blue: "#4A6FB5",
  tan: "#C0A173",
} as const;

export function BentwoodChair({
  x = 0,
  y = 0,
  flip = false,
}: {
  x?: number;
  y?: number;
  flip?: boolean;
}) {
  return (
    <g
      transform={`translate(${x}, ${y})${flip ? " scale(-1, 1)" : ""}`}
      stroke={CAFE_INKS.green}
      strokeWidth="5"
      strokeLinecap="round"
      fill="none"
    >
      {/* Outer hoop of the back */}
      <path d="M 20,122 C 13,44 24,14 55,14 C 86,14 97,44 90,122" />
      {/* Inner hoop */}
      <path d="M 36,118 C 32,58 41,34 55,34 C 69,34 78,58 74,118" />
      {/* The brace that makes it read as bentwood */}
      <path d="M 27,74 C 40,68 70,68 83,74" strokeWidth="4" />

      {/* Caned seat: fill, hatch, then rim */}
      <ellipse cx="55" cy="128" rx="43" ry="15" fill={CAFE_INKS.tan} stroke="none" />
      <g stroke={CAFE_INKS.paper} strokeWidth="1.4" opacity="0.65">
        {[-30, -18, -6, 6, 18, 30].map((dx) => (
          <line key={`v${dx}`} x1={55 + dx} y1="116" x2={55 + dx} y2="140" />
        ))}
        {[-8, 0, 8].map((dy) => (
          <line key={`h${dy}`} x1="14" y1={128 + dy} x2="96" y2={128 + dy} />
        ))}
      </g>
      <ellipse cx="55" cy="128" rx="43" ry="15" />

      {/* Legs, splayed and a touch bowed */}
      <path d="M 18,132 C 12,162 9,186 7,204" />
      <path d="M 92,132 C 98,162 101,186 103,204" />
      <path d="M 36,138 C 33,166 31,182 30,194" strokeWidth="4" />
      <path d="M 74,138 C 77,166 79,182 80,194" strokeWidth="4" />
      <path d="M 13,172 C 40,166 70,166 97,172" strokeWidth="3.5" />
    </g>
  );
}

export function BistroTable({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pedestal first, so the top overlaps it */}
      <g stroke={CAFE_INKS.green} strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M -7,30 L -7,60 M 7,30 L 7,60" />
        <path d="M -13,62 C -4,68 4,68 13,62" strokeWidth="5" />
        <path d="M -8,70 L -8,118 M 8,70 L 8,118" />
        {/* Three splayed feet with curled ends */}
        <path d="M 0,118 C -22,126 -42,138 -56,152 C -62,158 -58,166 -50,162" />
        <path d="M 0,118 C 22,126 42,138 56,152 C 62,158 58,166 50,162" />
        <path d="M 0,120 C 2,138 4,150 6,162 C 8,170 16,170 16,162" />
      </g>

      {/* Hand-cut pink top: an ellipse that isn't quite one */}
      <path
        d="M -96,2 C -94,-20 -56,-34 -4,-35 C 50,-36 94,-22 95,0
           C 96,22 52,36 -2,36 C -56,37 -98,24 -96,2 Z"
        fill={CAFE_INKS.pink}
      />
    </g>
  );
}

export type Vessel = "cup" | "glass" | "bowl" | "tumbler";

// Fallback icons, keyed by the drink's vessel and tinted by its ink. When
// you upload your own icon art and set drinks.icon_path, the app uses
// those instead and none of this runs — no code change needed.
export function DrinkIcon({
  vessel,
  ink,
  size = 54,
  steam = true,
}: {
  vessel: Vessel;
  ink: string;
  size?: number;
  steam?: boolean;
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="presentation" focusable="false">
      {steam && (
        <path
          d="M 50,30 C 44,24 56,20 50,13 C 45,7 55,4 51,-1"
          stroke={CAFE_INKS.blue}
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.8"
          transform="translate(0, 8)"
        />
      )}
      <g stroke={CAFE_INKS.blue} strokeWidth="3" fill="none" strokeLinecap="round">
        {vessel === "cup" && (
          <>
            <path
              d="M 28,44 L 31,68 C 31,74 37,78 50,78 C 63,78 69,74 69,68 L 72,44 Z"
              fill={ink}
            />
            <path d="M 72,50 C 84,48 86,62 74,64" />
            <ellipse cx="50" cy="84" rx="30" ry="6" />
          </>
        )}
        {vessel === "glass" && (
          <>
            {/* Tulip glass: pinched waist, flared lip */}
            <path
              d="M 34,36 C 30,50 40,58 40,66 C 40,74 34,78 34,84 L 66,84 C 66,78 60,74 60,66 C 60,58 70,50 66,36 Z"
              fill={ink}
            />
            <path d="M 32,36 L 68,36" />
            <ellipse cx="50" cy="88" rx="24" ry="5" />
          </>
        )}
        {vessel === "bowl" && (
          <>
            {/* Chawan: wide, shallow, footed */}
            <path d="M 22,46 C 22,68 34,78 50,78 C 66,78 78,68 78,46 Z" fill={ink} />
            <path d="M 20,46 L 80,46" />
            <path d="M 40,80 L 40,86 L 60,86 L 60,80" />
          </>
        )}
        {vessel === "tumbler" && (
          <>
            <path
              d="M 34,34 L 36,78 C 36,82 42,84 50,84 C 58,84 64,82 64,78 L 66,34 Z"
              fill={ink}
            />
            <path d="M 33,34 L 67,34" />
          </>
        )}
      </g>
    </svg>
  );
}

// One table with a chair either side. `children` are the drinks that end
// up on the tabletop.
export function TableSetting({
  children,
  label,
}: {
  children?: React.ReactNode;
  label: string;
}) {
  return (
    <div className="table-setting">
      <svg viewBox="0 0 420 300" role="img" aria-label={label} className="table-art">
        <rect x="0" y="0" width="420" height="300" fill={CAFE_INKS.paper} />
        <BentwoodChair x={18} y={58} />
        <BentwoodChair x={402} y={58} flip />
        <BistroTable x={210} y={150} />
      </svg>
      <div className="tabletop">{children}</div>
      <p className="table-label">{label}</p>
    </div>
  );
}
