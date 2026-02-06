import React from 'react';

interface VPointsIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  showText?: boolean;
}

/**
 * Custom SVG Icon for V Points - Hexagon Crystal "V" design
 */
const VPointsIcon: React.FC<VPointsIconProps> = ({ 
  size = 20, 
  className = '', 
  style = {},
  showText = false
}) => {
  const width = showText ? size * 3.5 : size;
  const viewBox = showText ? "0 0 350 100" : "0 0 100 100";

  return (
    <svg
      width={width}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        filter: 'drop-shadow(0px 2px 4px rgba(24, 144, 255, 0.3))',
        ...style
      }}
    >
      <defs>
        <linearGradient id="hexagonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#722ed1" />
          <stop offset="100%" stopColor="#1890ff" />
        </linearGradient>
        <linearGradient id="vGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.9" />
          <stop offset="100%" stopColor="white" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#722ed1" />
          <stop offset="100%" stopColor="#1890ff" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Hexagon Background */}
      <path
        d="M50 5 L89 27.5 L89 72.5 L50 95 L11 72.5 L11 27.5 Z"
        fill="url(#hexagonGradient)"
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth="2"
      />

      {/* Crystal V Shape */}
      <path
        d="M30 30 L50 75 L70 30 L60 30 L50 55 L40 30 Z"
        fill="url(#vGradient)"
        filter="url(#glow)"
      />

      {/* Gloss Effect */}
      <path
        d="M50 15 L80 32 L50 50 L20 32 Z"
        fill="white"
        fillOpacity="0.1"
      />

      {showText && (
        <text
          x="110"
          y="65"
          fill="url(#textGradient)"
          style={{
            fontFamily: 'Arial, sans-serif',
            fontWeight: '900',
            fontSize: '52px',
            letterSpacing: '-1px'
          }}
        >
          Points
        </text>
      )}
    </svg>
  );
};

export default VPointsIcon;
