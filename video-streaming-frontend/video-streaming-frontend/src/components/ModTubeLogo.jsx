import React from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * ModTube logo — uses actual PNG assets for dark/light modes.
 * Props:
 *   size      – controls height (width scales proportionally)
 *   className – extra classes
 */
export default function ModTubeLogo({ size = 36, className = '' }) {
  const { dark } = useTheme();

  return (
    <img
      src={dark ? '/logo_dark.png' : '/logo_light.png'}
      alt="ModTube"
      style={{ height: size, width: 'auto' }}
      className={className}
      draggable={false}
    />
  );
}
