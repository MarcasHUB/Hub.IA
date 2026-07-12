
interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 64 }: LogoProps) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="95" fill="#0b0f19" stroke="#334155" strokeWidth="4" />
        <circle cx="100" cy="100" r="90" fill="none" stroke="#06b6d4" strokeWidth="1" strokeDasharray="4 6" opacity="0.3" />
        
        {/* Stylized S and H in neon colors */}
        <g transform="translate(45, 45)">
          {/* S Shadow and Stroke */}
          <path 
            d="M 30,12 C 12,12 10,22 10,29 C 10,42 40,40 40,53 C 40,60 28,68 15,68" 
            fill="none" 
            stroke="#2563eb" 
            strokeWidth="10" 
            strokeLinecap="round" 
          />
          <path 
            d="M 30,12 C 12,12 10,22 10,29 C 10,42 40,40 40,53 C 40,60 28,68 15,68" 
            fill="none" 
            stroke="#38bdf8" 
            strokeWidth="5" 
            strokeLinecap="round" 
          />
          
          {/* H Stroke */}
          <path 
            d="M 62,12 L 62,68 M 90,12 L 90,68 M 62,40 L 90,40" 
            fill="none" 
            stroke="#2563eb" 
            strokeWidth="10" 
            strokeLinecap="round" 
          />
          <path 
            d="M 62,12 L 62,68 M 90,12 L 90,68 M 62,40 L 90,40" 
            fill="none" 
            stroke="#38bdf8" 
            strokeWidth="5" 
            strokeLinecap="round" 
          />
        </g>
        
        {/* SupplyHub text */}
        <text 
          x="90" 
          y="138" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontWeight="bold" 
          fontSize="17" 
          fill="#ffffff" 
          textAnchor="middle" 
          letterSpacing="0.5"
        >
          SupplyHub
        </text>
        <text 
          x="142" 
          y="138" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontWeight="900" 
          fontSize="13" 
          fill="#06b6d4" 
          textAnchor="start"
        >
          .IA
        </text>
        
        {/* Small business process flow icons visual representation (circles) */}
        <circle cx="50" cy="162" r="3.5" fill="#3b82f6" opacity="0.8" />
        <circle cx="75" cy="168" r="2.5" fill="#06b6d4" opacity="0.8" />
        <circle cx="100" cy="170" r="3.5" fill="#3b82f6" opacity="0.8" />
        <circle cx="125" cy="168" r="2.5" fill="#06b6d4" opacity="0.8" />
        <circle cx="150" cy="162" r="3.5" fill="#3b82f6" opacity="0.8" />
        
        {/* Bottom AI subtext */}
        <text 
          x="100" 
          y="186" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontWeight="semibold" 
          fontSize="8" 
          fill="#94a3b8" 
          textAnchor="middle" 
          letterSpacing="3"
        >
          I. A.
        </text>
      </svg>
    </div>
  );
}
