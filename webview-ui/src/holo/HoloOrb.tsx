import { useEffect, useRef, useState } from 'react';

import { PixelText } from '../components/ui/PixelText.js';
import {
  HOLO_LIGHT_ACTIVE,
  HOLO_LIGHT_IDLE,
  HOLO_LIGHT_PERMISSION,
  HOLO_LIGHT_WAITING,
  HOLO_ORB_CORE,
  HOLO_ORB_HIT_RADIUS,
  HOLO_ORB_LINK,
  HOLO_ORB_MERIDIANS,
  HOLO_ORB_PARALLELS,
  HOLO_ORB_PIXEL_SCALE,
  HOLO_ORB_RIM,
  HOLO_ORB_SATELLITE,
  HOLO_ORB_SATELLITE_ORBIT,
  HOLO_ORB_SIZE_PX,
  HOLO_ORB_TILT,
  HOLO_ORB_TURN_SEC,
  HOLO_ORB_WIRE_BACK,
  HOLO_ORB_WIRE_FRONT,
} from '../constants.js';
import type { OfficeState } from '../office/engine/officeState.js';
import type { Character } from '../office/types.js';
import { latLon, linePixels, nodePosition, type OrbPoint, projectOnOrb } from './orbGeometry.js';

/** Samples per wireframe circle. */
const WIRE_SAMPLES = 96;

interface HoloOrbProps {
  officeState: OfficeState;
  /** Main agents, in card order: each is a node. Sub-agents orbit their parent. */
  agents: number[];
  onSelectAgent: (id: number) => void;
}

type NodeStatus = 'active' | 'permission' | 'waiting' | 'idle';

function statusOf(ch: Character): NodeStatus {
  if (ch.bubbleType === 'permission') return 'permission';
  if (ch.bubbleType === 'waiting') return 'waiting';
  return ch.isActive ? 'active' : 'idle';
}

const NODE_COLOR: Record<NodeStatus, string> = {
  active: HOLO_LIGHT_ACTIVE,
  permission: HOLO_LIGHT_PERMISSION,
  waiting: HOLO_LIGHT_WAITING,
  idle: HOLO_LIGHT_IDLE,
};

function agentName(ch: Character, id: number): string {
  return ch.agentName ?? ch.directoryName ?? `Agent ${id}`;
}

/**
 * The network orb: a holographic globe, in pixel art, of every agent in the
 * office. Each agent is a node in its state's colour (blinking while it needs
 * approval), a Lead is linked to its Teammates, and Sub-agents orbit their
 * parent as satellites. Pressing a node goes to that agent.
 */
export function HoloOrb({ officeState, agents, onSelectAgent }: HoloOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Where each node landed last frame, for hit testing.
  const nodesRef = useRef<Array<{ id: number; point: OrbPoint }>>([]);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const [hovered, setHovered] = useState<number | null>(null);
  const hoveredRef = useRef<number | null>(null);
  hoveredRef.current = hovered;
  const [counts, setCounts] = useState({ total: 0, active: 0, permission: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const size = HOLO_ORB_SIZE_PX;
    canvas.width = size;
    canvas.height = size;
    let raf = 0;
    let lastCounts = '';

    const plot = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    };
    const square = (p: OrbPoint, half: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(p.px - half, p.py - half, half * 2 + 1, half * 2 + 1);
    };

    const draw = (time: number) => {
      const t = time / 1000;
      const spin = ((t % HOLO_ORB_TURN_SEC) / HOLO_ORB_TURN_SEC) * Math.PI * 2;
      const blinkOn = Math.floor(t * 2) % 2 === 0;
      ctx.clearRect(0, 0, size, size);

      // Core disc + rim.
      const centre = size / 2;
      const radius = size / 2 - 3;
      ctx.fillStyle = HOLO_ORB_CORE;
      for (let dy = -radius; dy <= radius; dy++) {
        const half = Math.floor(Math.sqrt(radius * radius - dy * dy));
        ctx.fillRect(Math.round(centre - half), Math.round(centre + dy), half * 2 + 1, 1);
      }

      // Wireframe: back half first, front half over it.
      for (const front of [false, true]) {
        const color = front ? HOLO_ORB_WIRE_FRONT : HOLO_ORB_WIRE_BACK;
        for (let m = 0; m < HOLO_ORB_MERIDIANS; m++) {
          const lon = (m / HOLO_ORB_MERIDIANS) * Math.PI;
          for (let k = 0; k < WIRE_SAMPLES; k++) {
            const lat = (k / WIRE_SAMPLES) * Math.PI * 2;
            // A full great circle through both poles at this longitude.
            const p = projectOnOrb(
              {
                x: Math.cos(lat) * Math.cos(lon),
                y: Math.sin(lat),
                z: Math.cos(lat) * Math.sin(lon),
              },
              spin,
              HOLO_ORB_TILT,
              size,
            );
            if (p.depth > 0 === front) plot(p.px, p.py, color);
          }
        }
        for (let q = 1; q <= HOLO_ORB_PARALLELS; q++) {
          const lat = -Math.PI / 2 + (q / (HOLO_ORB_PARALLELS + 1)) * Math.PI;
          for (let k = 0; k < WIRE_SAMPLES; k++) {
            const p = projectOnOrb(
              latLon(lat, (k / WIRE_SAMPLES) * Math.PI * 2),
              spin,
              HOLO_ORB_TILT,
              size,
            );
            if (p.depth > 0 === front) plot(p.px, p.py, color);
          }
        }
      }
      for (let k = 0; k < WIRE_SAMPLES * 2; k++) {
        const a = (k / (WIRE_SAMPLES * 2)) * Math.PI * 2;
        plot(
          Math.round(centre + Math.cos(a) * (radius + 1)),
          Math.round(centre + Math.sin(a) * (radius + 1)),
          HOLO_ORB_RIM,
        );
      }

      // Nodes.
      const ids = agentsRef.current.filter((id) => {
        const ch = officeState.characters.get(id);
        return ch && !ch.isSubagent;
      });
      const placed = ids.map((id, i) => ({
        id,
        point: projectOnOrb(nodePosition(i, ids.length), spin, HOLO_ORB_TILT, size),
      }));
      const pointOf = new Map(placed.map((n) => [n.id, n.point]));

      // Lead ↔ Teammate links.
      for (const { id, point } of placed) {
        const lead = officeState.characters.get(id)?.leadAgentId;
        const leadPoint = lead !== undefined ? pointOf.get(lead) : undefined;
        if (!leadPoint) continue;
        const pixels = linePixels(leadPoint.px, leadPoint.py, point.px, point.py);
        pixels.forEach(([x, y], i) => {
          if (i % 2 === 0) plot(x, y, HOLO_ORB_LINK);
        });
      }

      // Back nodes, then front ones (bigger).
      const sorted = [...placed].sort((a, b) => a.point.depth - b.point.depth);
      let active = 0;
      let permission = 0;
      for (const { id, point } of sorted) {
        const ch = officeState.characters.get(id);
        if (!ch) continue;
        const status = statusOf(ch);
        if (status === 'active') active++;
        if (status === 'permission') permission++;
        if (status === 'permission' && !blinkOn) continue;
        const front = point.depth > 0;
        // A front node: a 5×5 diamond-ish blip with a bright core; a back one: 3×3.
        square(point, front ? 2 : 1, NODE_COLOR[status]);
        if (front) square(point, 0, HOLO_ORB_SATELLITE);
        if (hoveredRef.current === id || officeState.selectedAgentId === id) {
          // A bracket around the picked node.
          for (const [dx, dy] of [
            [-4, -4],
            [-3, -4],
            [-4, -3],
            [4, -4],
            [3, -4],
            [4, -3],
            [-4, 4],
            [-3, 4],
            [-4, 3],
            [4, 4],
            [3, 4],
            [4, 3],
          ] as const) {
            plot(point.px + dx, point.py + dy, HOLO_ORB_SATELLITE);
          }
        }
      }

      // Sub-agents: satellites circling their parent's node.
      let satIndex = 0;
      for (const ch of officeState.characters.values()) {
        if (!ch.isSubagent || ch.parentAgentId === null) continue;
        const parent = pointOf.get(ch.parentAgentId);
        if (!parent) continue;
        const a = t * 2.5 + satIndex * 2.1;
        satIndex++;
        plot(
          Math.round(parent.px + Math.cos(a) * HOLO_ORB_SATELLITE_ORBIT),
          Math.round(parent.py + Math.sin(a) * HOLO_ORB_SATELLITE_ORBIT * 0.6),
          HOLO_ORB_SATELLITE,
        );
      }

      nodesRef.current = placed;
      const key = `${ids.length}:${active}:${permission}`;
      if (key !== lastCounts) {
        lastCounts = key;
        setCounts({ total: ids.length, active, permission });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [officeState]);

  const nodeAt = (clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * HOLO_ORB_SIZE_PX;
    const y = ((clientY - rect.top) / rect.height) * HOLO_ORB_SIZE_PX;
    let best: { id: number; d: number } | null = null;
    for (const { id, point } of nodesRef.current) {
      const d = Math.hypot(point.px - x, point.py - y) - (point.depth > 0 ? 1 : 0);
      if (d <= HOLO_ORB_HIT_RADIUS && (!best || d < best.d)) best = { id, d };
    }
    return best?.id ?? null;
  };

  const hoveredCh = hovered !== null ? officeState.characters.get(hovered) : undefined;
  const cssSize = HOLO_ORB_SIZE_PX * HOLO_ORB_PIXEL_SCALE;

  return (
    <div
      className="holo-orb flex flex-col items-center p-6 gap-4 pointer-events-auto"
      style={{ width: cssSize + 16 }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Agent network"
        style={{
          width: cssSize,
          height: cssSize,
          imageRendering: 'pixelated',
          cursor: hovered !== null ? 'pointer' : 'default',
        }}
        onMouseMove={(e) => setHovered(nodeAt(e.clientX, e.clientY))}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => {
          const id = nodeAt(e.clientX, e.clientY);
          if (id !== null) onSelectAgent(id);
        }}
      />
      <div className="holo-orb-caption flex items-center gap-6 whitespace-nowrap overflow-hidden max-w-full">
        {hoveredCh && hovered !== null ? (
          <span className="overflow-hidden text-ellipsis">{agentName(hoveredCh, hovered)}</span>
        ) : (
          <>
            <span>Net</span>
            <PixelText text={`${counts.total}`} />
            <span>agents</span>
            <PixelText text={`${counts.active}`} />
            <span>live</span>
            {counts.permission > 0 && (
              <span
                className="flex items-center gap-4"
                style={{ color: 'var(--color-status-permission)' }}
              >
                <PixelText text={`${counts.permission}`} />
                <span>wait</span>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
