type Props = {
  className?: string;
  tone?: 'emerald' | 'green' | 'teal';
};

export default function GreenHouseLogo({
  className = 'w-16 h-16',
  tone = 'emerald',
}: Props) {
  const colors =
    tone === 'teal'
      ? ['#14b8a6', '#0f766e']
      : tone === 'green'
      ? ['#22c55e', '#15803d']
      : ['#10b981', '#047857']; // emerald

  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="GreenHouse Pro"
    >
      <defs>
        {/* Main gradient */}
        <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>

        {/* Soft highlight */}
        <radialGradient id="light" cx="30%" cy="25%" r="65%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>

        {/* Shadow */}
        <filter id="softShadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* App icon background */}
      <g filter="url(#softShadow)">
        <rect
          x="10"
          y="10"
          width="108"
          height="108"
          rx="28"
          fill="url(#bgGrad)"
        />
        <rect
          x="10"
          y="10"
          width="108"
          height="108"
          rx="28"
          fill="url(#light)"
        />
      </g>

      {/* Minimal leaf mark */}
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      >
        {/* Main leaf */}
        <path d="M64 28C46 40 36 60 36 78c0 20 14 34 28 34s28-14 28-34c0-18-10-38-28-50Z" />

        {/* Center vein */}
        <path d="M64 44v60" opacity="0.6" />

        {/* Sub vein */}
        <path d="M64 68c10-6 18-10 26-12" opacity="0.25" />
      </g>

      {/* Accent dot */}
      <circle cx="92" cy="34" r="3.5" fill="#fff" opacity="0.85" />
    </svg>
  );
}
