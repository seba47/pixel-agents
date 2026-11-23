import { ARCHIPELAGO_AGENT_COLORS } from '../constants.js';

/** The archipelago's face for a character: its robot, round, in its palette's colour. */
export function RobotAvatar({ palette, size }: { palette: number; size: number }) {
  return (
    <span
      className="archi-robot"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: ARCHIPELAGO_AGENT_COLORS[palette % ARCHIPELAGO_AGENT_COLORS.length],
      }}
    />
  );
}
