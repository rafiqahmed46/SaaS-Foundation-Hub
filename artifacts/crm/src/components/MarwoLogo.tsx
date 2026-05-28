interface Props {
  size?: number;
  className?: string;
}

export function MarwoMark({ size = 36, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Marwo"
    >
      <defs>
        <linearGradient id="marwo-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width="40" height="40" rx="9" fill="url(#marwo-bg)" />
      {/* M lettermark */}
      <path
        d="M6 31 L6 9 L11 9 L20 22 L29 9 L34 9 L34 31 L29.5 31 L29.5 17.5 L20 27.5 L10.5 17.5 L10.5 31 Z"
        fill="white"
      />
      {/* Orange spark dot — top-right accent */}
      <circle cx="33" cy="8" r="3.5" fill="#f97316" />
    </svg>
  );
}

export function MarwoWordmark({ size = 36, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <MarwoMark size={size} />
      <div className="flex flex-col leading-none">
        <span
          className="font-bold tracking-tight"
          style={{
            fontSize: size * 0.5,
            color: dark ? "#111827" : "white",
            lineHeight: 1,
          }}
        >
          Marwo
        </span>
        <span
          className="font-normal tracking-wide uppercase"
          style={{
            fontSize: size * 0.22,
            color: dark ? "#6b7280" : "rgba(255,255,255,0.55)",
            letterSpacing: "0.08em",
            lineHeight: 1,
            marginTop: 3,
          }}
        >
          Field Service Made Simple
        </span>
      </div>
    </div>
  );
}

export default MarwoMark;
