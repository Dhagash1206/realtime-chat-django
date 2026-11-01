// Decorative background for the auth screen: soft blurred waves in the brand palette
export default function WaveArt() {
  return (
    <svg
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wave-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3e3c3" />
          <stop offset="0.55" stopColor="#c5cfe8" />
          <stop offset="1" stopColor="#4a63a6" stopOpacity="0" />
        </linearGradient>
        <filter id="soft-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="38" />
        </filter>
      </defs>
      <rect width="600" height="800" fill="#15224a" />
      <path
        d="M470 -80 C 260 120, 560 300, 340 470 S 150 760, 420 900"
        stroke="#4a63a6"
        strokeWidth="260"
        fill="none"
        opacity="0.55"
        filter="url(#soft-blur)"
      />
      <path
        d="M430 -60 C 250 140, 520 300, 330 470 S 170 760, 400 880"
        stroke="url(#wave-light)"
        strokeWidth="130"
        fill="none"
        filter="url(#soft-blur)"
      />
    </svg>
  );
}
