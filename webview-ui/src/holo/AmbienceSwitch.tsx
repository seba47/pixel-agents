import type { HoloAmbience } from './holoMode.js';
import { holoMode } from './holoMode.js';
import { useHoloMode } from './useHoloMode.js';

const OPTIONS: Array<{ value: HoloAmbience; label: string; title: string }> = [
  { value: 'day', label: 'Day', title: 'A bright lab console' },
  { value: 'night', label: 'Night', title: 'The room dark, lit around each agent' },
  { value: 'auto', label: 'Auto', title: 'Day from 7:00 to 19:00, night otherwise' },
];

/** Holo Mode's ambience: a segmented pill (Day / Night / Auto). */
export function AmbienceSwitch() {
  const { ambience } = useHoloMode();
  return (
    <div className="holo-switch pointer-events-auto" role="group" aria-label="Ambience">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={ambience === o.value}
          onClick={() => holoMode.setAmbience(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
