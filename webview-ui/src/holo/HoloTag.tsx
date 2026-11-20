import type { ReactNode } from 'react';

export type HoloTagStatus = 'active' | 'permission' | 'waiting' | 'idle';

const PIN_COLOR: Record<HoloTagStatus, string> = {
  active: 'var(--color-status-active)',
  permission: 'var(--color-status-permission)',
  waiting: 'var(--color-status-success)',
  idle: 'var(--color-text-muted)',
};

interface HoloTagProps {
  /** What the agent is doing, shown upper-cased: "EDIT · APP.TSX". */
  activity: string;
  /** Team role ("LEAD", a teammate's name) or the agent's Directory. */
  heading?: string | null;
  status: HoloTagStatus;
  /** Hovered or selected: the plate grows its heading and whatever `extra` holds. */
  expanded: boolean;
  /** Sub-agents' tags are smaller and italic. */
  small?: boolean;
  /** Right of the text (the close ×). */
  action?: ReactNode;
  /** Under the plate, above the stem (the context gauge). */
  extra?: ReactNode;
}

/** Holo Mode's label for one agent: a pinned annotation plate with a stem down to its head. */
export function HoloTag({
  activity,
  heading,
  status,
  expanded,
  small,
  action,
  extra,
}: HoloTagProps) {
  return (
    <div className="holo-tag" data-status={status}>
      <div className="holo-tag-plate">
        <span
          className={`holo-tag-pin ${status === 'active' ? 'pixel-pulse' : ''}`}
          style={{ background: PIN_COLOR[status] }}
        />
        <div className="flex flex-col overflow-hidden max-w-2xs">
          {expanded && heading && (
            <span className="text-2xs leading-none text-text-muted overflow-hidden text-ellipsis">
              {heading}
            </span>
          )}
          <span
            className="leading-none overflow-hidden text-ellipsis"
            style={{ fontSize: small ? '16px' : '18px', fontStyle: small ? 'italic' : undefined }}
          >
            {activity}
          </span>
        </div>
        {action}
      </div>
      {extra}
      <div className="holo-tag-stem" />
      <div className="holo-tag-foot" />
    </div>
  );
}
