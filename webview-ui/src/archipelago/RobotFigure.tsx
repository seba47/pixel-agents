import { useId } from 'react';

import { ARCHIPELAGO_AGENT_COLORS, ARCHIPELAGO_ROBOT as R } from '../constants.js';

/**
 * A character as the archipelago's robot, whole (the 3D body drawn flat):
 * capsule body in its palette's colour, belly, visor with glowing eyes, an
 * antenna. `active` makes it bob and wave (the roster's hover).
 */
export function RobotFigure({
  palette,
  height,
  active = false,
}: {
  palette: number;
  height: number;
  active?: boolean;
}) {
  const color = ARCHIPELAGO_AGENT_COLORS[palette % ARCHIPELAGO_AGENT_COLORS.length];
  const id = useId().replace(/:/g, '');
  const shade = `robot-shade-${id}`;
  const shine = `robot-shine-${id}`;
  return (
    <svg
      className={`archi-figure ${active ? 'archi-figure-on' : ''}`}
      viewBox="0 0 60 84"
      width={(height * 60) / 84}
      height={height}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={shade} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={R.light} stopOpacity="0.28" />
          <stop offset="0.55" stopColor={R.light} stopOpacity="0" />
          <stop offset="1" stopColor={R.dark} stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={shine} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={R.light} stopOpacity="0.35" />
          <stop offset="1" stopColor={R.light} stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="30" cy="81" rx="15" ry="2.6" fill={R.dark} opacity="0.12" />
      <g className="archi-figure-body">
        {/* antenna */}
        <rect x="29.2" y="6" width="1.6" height="9" rx="0.8" fill={R.antenna} />
        <circle cx="30" cy="5" r="3.4" fill={R.glow} />
        <circle cx="30" cy="5" r="5.5" fill={R.glow} opacity="0.25" />
        {/* arms, behind the body */}
        <g className="archi-figure-arm-l">
          <rect x="7" y="34" width="7" height="20" rx="3.5" fill={color} />
          <rect x="7" y="34" width="7" height="20" rx="3.5" fill={`url(#${shade})`} />
        </g>
        <g className="archi-figure-arm-r">
          <rect x="46" y="34" width="7" height="20" rx="3.5" fill={color} />
          <rect x="46" y="34" width="7" height="20" rx="3.5" fill={`url(#${shade})`} />
        </g>
        {/* body */}
        <rect x="13" y="14" width="34" height="60" rx="17" fill={color} />
        <rect x="13" y="14" width="34" height="60" rx="17" fill={`url(#${shade})`} />
        <ellipse cx="30" cy="57" rx="11" ry="12" fill={R.belly} />
        {/* visor + eyes */}
        <rect x="16" y="24" width="28" height="14" rx="7" fill={R.visor} />
        <rect x="17" y="25" width="26" height="6" rx="3" fill={`url(#${shine})`} />
        <rect x="22" y="28.5" width="4" height="6" rx="2" fill={R.eyes} />
        <rect x="34" y="28.5" width="4" height="6" rx="2" fill={R.eyes} />
      </g>
      {/* feet */}
      <ellipse cx="22" cy="76" rx="6.5" ry="4" fill={R.feet} />
      <ellipse cx="38" cy="76" rx="6.5" ry="4" fill={R.feet} />
    </svg>
  );
}
