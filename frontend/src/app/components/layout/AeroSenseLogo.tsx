import React from 'react';

interface AeroSenseLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  iconSize?: number;
  showText?: boolean;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

const sizeMap = {
  sm: { icon: 28, text: 'text-lg tracking-tight' },
  md: { icon: 36, text: 'text-2xl tracking-tight' },
  lg: { icon: 48, text: 'text-4xl tracking-tight' },
  xl: { icon: 60, text: 'text-5xl tracking-tight' },
  xxl: { icon: 72, text: 'text-6xl tracking-tight' },
};

export function AeroSenseLogo({
  size = 'md',
  iconSize,
  showText = true,
  className = '',
  orientation = 'horizontal'
}: AeroSenseLogoProps) {
  const { icon, text } = sizeMap[size];

  const finalIconSize = iconSize || icon;
  const isVertical = orientation === 'vertical';

  return (
    <div className={`flex ${isVertical ? 'flex-col gap-3' : 'items-center gap-2'} ${className}`}>
      <img 
        src="/AEROSENSELOGO.png" 
        alt="Brand Logo" 
        width={finalIconSize} 
        height={finalIconSize} 
        className="object-contain"
      />
      {showText && (
        <span className={`font-bold ${text} ${className.includes('text-white') ? 'text-white' : 'text-[#0B1847]'}`}>
          Aero<span className="bg-[linear-gradient(to_right,#00b6bd,#00acce,#03a3d9,#02a0e3,#018afd)] bg-clip-text text-transparent">Sense</span>
        </span>
      )}
    </div>
  );
}
