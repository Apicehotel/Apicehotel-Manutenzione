export default function CyberCatOrb({ className = '', title = 'RandAI' }) {
  const gradientId = 'randai-cyber-orb-gradient'
  const glowId = 'randai-cyber-orb-glow'

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#08d9ff" />
          <stop offset="0.5" stopColor="#2697ff" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="32" cy="32" r="29" fill="#06111f" stroke={`url(#${gradientId})`} strokeWidth="3.2" filter={`url(#${glowId})`} />
      <circle cx="32" cy="32" r="25.5" fill="#071424" opacity="0.96" />

      <path
        d="M18 27.2V19l8 5.2c1.9-.8 3.9-1.2 6-1.2s4.1.4 6 1.2L46 19v8.2c2.4 2.7 3.5 6 3.5 9.5 0 8.2-7.8 13.8-17.5 13.8s-17.5-5.6-17.5-13.8c0-3.5 1.1-6.8 3.5-9.5Z"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path d="M32 23.2V16.7" stroke="#2aa7ff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="14.2" r="2.3" fill="#06111f" stroke="#32b9ff" strokeWidth="1.9" />

      <rect x="22.2" y="32.1" width="4.2" height="8.2" rx="2.1" fill="#16d9ff" filter={`url(#${glowId})`} />
      <rect x="37.6" y="32.1" width="4.2" height="8.2" rx="2.1" fill="#4bb9ff" filter={`url(#${glowId})`} />
      <path d="M29.6 42.3 32 44.4l2.4-2.1" fill="none" stroke="#25d9ff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />

      <path d="M13.2 35.2H8.8M13.5 39H9.8M50.8 35.2h4.4M50.5 39h3.7" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" />
      <path d="M14.6 42.4 10.8 44M49.4 42.4l3.8 1.6" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
