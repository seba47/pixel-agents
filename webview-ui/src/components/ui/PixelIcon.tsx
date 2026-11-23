import type { CSSProperties } from 'react';

import { useArchipelagoUi } from '../../archipelago/archipelagoMode.js';
import { LineIcon } from '../../archipelago/LineIcon.js';
import { PIXEL_ICON_SCALE } from '../../constants.js';
import { useDevicePixelRatio } from '../../hooks/useDevicePixelRatio.js';
import { gridRuns } from './pixelGrid.js';
import type { PixelIconName } from './pixelIcons.js';
import { ICONS } from './pixelIcons.js';
import { devicePixelsPerArtPixel } from './pixelSnap.js';
import { PixelSvg } from './PixelSvg.js';

export type { PixelIconName } from './pixelIcons.js';

/**
 * A pixel-art icon in the text colour. Each icon pixel covers a whole number
 * of device pixels (`scale` CSS px, rounded down when the display or browser
 * zoom makes that fractional), so its rows and columns all come out equal
 * (pixelSnap.ts).
 */
export function PixelIcon({
  name,
  scale = PIXEL_ICON_SCALE,
  className = '',
  style,
}: {
  name: PixelIconName;
  /** CSS pixels per icon pixel. Whole numbers only: 1 is one step smaller. */
  scale?: number;
  className?: string;
  /** Whole-pixel transforms only (a nudge), so the icon stays crisp. */
  style?: CSSProperties;
}) {
  const grid = ICONS[name];
  const cols = Math.max(...grid.map((row) => row.length));
  const dpr = useDevicePixelRatio();
  const unit = devicePixelsPerArtPixel(scale, dpr) / dpr;
  // The archipelago theme draws the same icon as a line icon, the same size.
  const archipelago = useArchipelagoUi();
  if (archipelago)
    return <LineIcon name={name} size={8 * scale} className={className} style={style} />;

  return (
    <PixelSvg
      rects={gridRuns(grid)}
      width={cols}
      height={grid.length}
      unit={unit}
      className={className}
      style={style}
    />
  );
}
