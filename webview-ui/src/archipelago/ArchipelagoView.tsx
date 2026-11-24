import './archipelago.css';

import { useEffect, useRef, useState } from 'react';

import {
  ARCHIPELAGO_CLEAN_MS,
  ARCHIPELAGO_HUD_INTERVAL_MS,
  ARCHIPELAGO_QUIET_MS,
  ARCHIPELAGO_TITLES_INTERVAL_MS,
} from '../constants.js';
import { transport } from '../transport/index.js';
import { crewFrom, type CrewSource } from './crew.js';
import { ISLAND_THEMES, type IslandThemeId, islandThemes, suggestTheme } from './islandThemes.js';
import { LineIcon } from './LineIcon.js';
import { type ArchipelagoAgent, ArchipelagoScene } from './scene.js';

interface ArchipelagoViewProps extends Omit<CrewSource, 'titles'> {
  /** Go to an agent: select + follow it and show its terminal (the card's own action). */
  onSelectAgent: (id: number) => void;
  /** The HUD's distance from the office's right edge (clear of the card bar). */
  hudRight: number;
  /** A crew card pressed: the card bar's own action (its terminal, select + follow). */
  onCardSelect: (id: number) => void;
  /** The agent whose terminal is shown, highlighted in the crew dock. */
  activeAgentId: number | null;
  /** Agents with a terminal in this office; null where the office has no
   *  terminals at all (VS Code, watch-only). The rest run elsewhere (Orca, another terminal). */
  terminalAgentIds: number[] | null;
  /** The office's zoom level: its +/− buttons move the 3D camera in and out. */
  zoom: number;
  /** Phone: its own card bar does the dock's job, and the top holds its buttons. */
  compact: boolean;
}

/** An agent as shown, with how long nothing about it has changed. */
type Shown = ArchipelagoAgent & { quietMs: number; unread: boolean };

const STATE_LABEL: Record<ArchipelagoAgent['state'], string> = {
  work: 'Working',
  need: 'Needs you',
  done: 'Done',
  idle: 'Idle',
};

/** One +/− step: the camera's distance to its target, times this (or its inverse). */
const ZOOM_IN_STEP = 0.8;

/** Each agent's card, then its Sub-agents' right after it. */
const dockOrder = (crew: Shown[]) =>
  crew
    .filter((a) => a.parentId === null)
    .flatMap((a) => [a, ...crew.filter((s) => s.parentId === a.id)]);

/** The context bar's colour by share used, the office gauge's steps. */
const contextLevel = (used: number) =>
  used > 0.66 ? 'archi-ctx-high' : used > 0.33 ? 'archi-ctx-mid' : 'archi-ctx-low';

const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

/**
 * The office as an archipelago (experiment): one island per Directory, the
 * agents as 3D characters whose spot tells their state. Replaces the office
 * canvas only; the card bar, terminals and toolbar stay as they are.
 */
export function ArchipelagoView(props: ArchipelagoViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  // Running agents' conversation titles, from the same list the sidebar shows.
  const titles = useRef<Map<number, string>>(new Map());
  // When each agent last changed (state or what it's doing). An agent that
  // claims to be working with nothing changing for a while has most likely
  // gone (its session closed without saying so): it shows as without activity.
  const changed = useRef<Map<number, { sig: string; at: number }>>(new Map());
  // Finished while you weren't looking: stays marked until you look at it
  // (select it, or its terminal shows) or it starts working again. The
  // office's "done" bubble lasts two seconds; this lasts until it's read.
  const unread = useRef<Set<number>>(new Set());
  const shownCrew = (): Shown[] => {
    const now = Date.now();
    const p = latest.current;
    const list = crewFrom({ ...p, titles: titles.current });
    return list.map((a) => {
      const sig = `${a.state}|${a.activity}`;
      const seen = changed.current.get(a.id);
      if (!seen || seen.sig !== sig) changed.current.set(a.id, { sig, at: now });
      const quietMs = now - (changed.current.get(a.id)?.at ?? now);
      const looking = a.followed || a.id === p.activeAgentId;
      if (a.state === 'work' || a.state === 'need' || looking) unread.current.delete(a.id);
      else if (a.state === 'done' && a.parentId === null) unread.current.add(a.id);
      if (unread.current.has(a.id))
        return { ...a, state: 'done', activity: 'Terminó · sin leer', quietMs, unread: true };
      if (a.state === 'work' && quietMs >= ARCHIPELAGO_QUIET_MS)
        return {
          ...a,
          state: 'idle',
          activity: `Sin actividad · ${minutes(quietMs)} min`,
          quietMs,
          unread: false,
        };
      return { ...a, quietMs, unread: false };
    });
  };

  useEffect(() => {
    const off = transport.onMessage((msg) => {
      if (msg.type !== 'conversationsLoaded') return;
      const next = new Map<number, string>();
      for (const d of msg.directories)
        for (const c of d.conversations)
          if (c.agentId !== undefined && c.title) next.set(c.agentId, c.title);
      titles.current = next;
    });
    const ask = () => transport.send({ type: 'requestConversations' });
    ask();
    const every = window.setInterval(ask, ARCHIPELAGO_TITLES_INTERVAL_MS);
    return () => {
      window.clearInterval(every);
      off();
    };
  }, []);
  const [crew, setCrew] = useState<Shown[]>([]);
  const [confirmClose, setConfirmClose] = useState<number | null>(null);
  const [islands, setIslands] = useState<string[]>([]);
  // The island whose style is being changed (pencil), if any.
  const [restyling, setRestyling] = useState<string | null>(null);
  const [, setThemesSeen] = useState(0);
  useEffect(() => islandThemes.subscribe(() => setThemesSeen((n) => n + 1)), []);
  const sceneRef = useRef<ArchipelagoScene | null>(null);
  const lastZoom = useRef(props.zoom);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new ArchipelagoScene(host, {
      getCrew: shownCrew,
      // A Sub-agent's terminal is its parent's.
      onSelect: (id) =>
        latest.current.onSelectAgent(shownCrew().find((a) => a.id === id)?.parentId ?? id),
      onIslands: setIslands,
      themeOf: (project) => islandThemes.get(project) ?? 'beach',
    });
    sceneRef.current = scene;
    const timer = window.setInterval(() => setCrew(shownCrew()), ARCHIPELAGO_HUD_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      scene.dispose();
      sceneRef.current = null;
    };
    // shownCrew reads refs only: one scene for the view's life.
  }, []);

  // The office's +/− buttons: each step moves the camera in or out.
  useEffect(() => {
    const prev = lastZoom.current;
    lastZoom.current = props.zoom;
    if (props.zoom === prev) return;
    sceneRef.current?.zoomBy(props.zoom > prev ? ZOOM_IN_STEP : 1 / ZOOM_IN_STEP);
  }, [props.zoom]);

  /** Runs outside this office (Orca, another terminal): closing it only takes it off the view. */
  const external = (a: Shown) =>
    a.parentId === null &&
    props.terminalAgentIds !== null &&
    !props.terminalAgentIds.includes(a.id);
  /** Quiet long enough that, from elsewhere, its session has most likely ended. */
  const inactive = (a: Shown) => a.state !== 'need' && a.quietMs >= ARCHIPELAGO_CLEAN_MS;
  /** Closing works only in an office with terminals (standalone). */
  const closable = (a: Shown) => a.parentId === null && props.terminalAgentIds !== null;
  const close = (id: number) => {
    transport.send({ type: 'closeAgent', id });
    changed.current.delete(id);
    setConfirmClose(null);
  };
  // Clean up: hide every agent from elsewhere quiet long enough. Never the
  // ones launched here (closing those would end their session).
  const stale = crew.filter((a) => external(a) && inactive(a));

  // A new island (no style chosen yet) asks for one; the pencil asks again.
  const asking = restyling ?? islands.find((n) => islandThemes.get(n) === undefined) ?? null;
  const choose = (name: string, theme: IslandThemeId) => {
    islandThemes.set(name, theme);
    setRestyling(null);
  };

  const count = (s: ArchipelagoAgent['state']) => crew.filter((a) => a.state === s).length;
  const unreadCrew = crew.filter((a) => a.unread);
  const needs = crew.filter((a) => a.state === 'need');
  return (
    <div ref={hostRef} className="archi absolute inset-0">
      <div className="archi-hud" style={{ right: props.hudRight, top: props.compact ? 64 : 12 }}>
        <div className="archi-chips">
          <span className="archi-chip archi-glass">
            <i className="archi-dot archi-work" />
            {count('work')} working
          </span>
          <span className="archi-chip archi-glass">
            <i className="archi-dot archi-done" />
            {count('done')} done
          </span>
          {needs.length > 0 && (
            <span className="archi-chip archi-chip-need">
              <i className="archi-dot" />
              {needs.length} need{needs.length > 1 ? '' : 's'} you
            </span>
          )}
          {unreadCrew.length > 0 && (
            <button
              type="button"
              className="archi-chip archi-chip-unread"
              title="Agents that finished while you weren't looking: go to the first"
              onClick={() => props.onSelectAgent(unreadCrew[0].id)}
            >
              <LineIcon name="check" size={13} />
              {unreadCrew.length} sin leer
            </button>
          )}
          {stale.length > 0 && (
            <button
              type="button"
              className="archi-chip archi-glass archi-clean"
              title={`Hide ${stale.length} agent(s) from outside this web with no activity for ${minutes(ARCHIPELAGO_CLEAN_MS)}+ min. If a session is still running, it keeps running where it is.`}
              onClick={() => stale.forEach((a) => close(a.id))}
            >
              <LineIcon name="hide" size={13} />
              Limpiar {stale.length} inactivo{stale.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
        {islands.length > 0 && (
          <div className="archi-nav archi-glass">
            {islands.map((name, i) => (
              <span key={name} className="archi-nav-isl">
                <button
                  type="button"
                  title={`Go to ${name}`}
                  onClick={() => sceneRef.current?.goIsland(i)}
                >
                  {i < 9 && !props.compact && <kbd>{i + 1}</kbd>}
                  {name}
                </button>
                <button
                  type="button"
                  className="archi-nav-style"
                  title={`Change ${name}'s style`}
                  onClick={() => setRestyling(restyling === name ? null : name)}
                >
                  <LineIcon name="pencil" size={11} />
                </button>
              </span>
            ))}
            <button
              type="button"
              title="Everything in view (0)"
              onClick={() => sceneRef.current?.showAll()}
            >
              <LineIcon name="zoomOut" size={13} />
              Ver todo
            </button>
            {!props.compact && (
              <div className="archi-nav-help">
                Arrastrá para moverte · clic derecho gira · WASD · doble clic acerca
              </div>
            )}
          </div>
        )}
        {asking !== null && (
          <div className="archi-glass archi-style-card">
            <div className="archi-style-title">
              {restyling ? 'Estilo de' : 'Nueva isla'} <b>{asking}</b>
              {restyling && (
                <button
                  type="button"
                  className="archi-style-x"
                  title="Close"
                  onClick={() => setRestyling(null)}
                >
                  <LineIcon name="close" size={12} />
                </button>
              )}
            </div>
            <div className="archi-style-grid">
              {ISLAND_THEMES.map((t) => {
                const current =
                  (islandThemes.get(asking) ?? (restyling ? 'beach' : undefined)) === t.id;
                const suggested = !restyling && suggestTheme(asking) === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={t.hint}
                    className={`archi-style-opt archi-style-${t.id} ${current || suggested ? 'archi-style-on' : ''}`}
                    onClick={() => choose(asking, t.id)}
                  >
                    <i />
                    {t.label}
                    {suggested && <small>sugerido</small>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {needs.map((a) => (
          <div key={a.id} className="archi-glass archi-need-card">
            <div className="archi-who">
              <span className="archi-avatar" style={{ background: a.color }} />
              <div>
                {a.name}
                <small>{a.project}</small>
              </div>
            </div>
            <div className="archi-what">{a.activity}</div>
            <button type="button" className="archi-btn" onClick={() => props.onSelectAgent(a.id)}>
              Open terminal
            </button>
          </div>
        ))}
      </div>
      {crew.length > 0 && !props.compact && (
        <div className="archi-dock archi-glass">
          {dockOrder(crew).map((a) => (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              className={`archi-crew ${a.parentId !== null ? 'archi-crew-sub' : ''} ${a.unread ? 'archi-crew-unread' : ''} ${a.id === props.activeAgentId || a.followed ? 'archi-crew-on' : ''}`}
              onClick={() => props.onCardSelect(a.parentId ?? a.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') props.onCardSelect(a.parentId ?? a.id);
              }}
            >
              {closable(a) && (
                <button
                  type="button"
                  className="archi-close"
                  title={
                    external(a)
                      ? 'Hide from the office (the session keeps running in its own terminal)'
                      : 'Close this session'
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (external(a)) close(a.id);
                    else setConfirmClose(a.id);
                  }}
                >
                  <LineIcon name={external(a) ? 'hide' : 'close'} size={12} />
                </button>
              )}
              {confirmClose === a.id && (
                <span className="archi-confirm" onClick={(e) => e.stopPropagation()}>
                  ¿Cerrar la sesión?
                  <button type="button" className="archi-confirm-yes" onClick={() => close(a.id)}>
                    Cerrar
                  </button>
                  <button type="button" onClick={() => setConfirmClose(null)}>
                    No
                  </button>
                </span>
              )}
              <span className="archi-row">
                <span className="archi-avatar archi-avatar-bot" style={{ background: a.color }}>
                  <i className={`archi-st archi-st-${a.state}`} />
                </span>
                <span className="archi-id">
                  <span className="archi-crew-name">
                    {a.name}
                    {a.unread && <span className="archi-new">Nuevo</span>}
                    {external(a) &&
                      (inactive(a) ? (
                        <button
                          type="button"
                          className="archi-ext archi-ext-off"
                          title={`No activity for ${minutes(a.quietMs)} min: its terminal was most likely closed. Click to hide it.`}
                          onClick={(e) => {
                            e.stopPropagation();
                            close(a.id);
                          }}
                        >
                          inactiva
                        </button>
                      ) : (
                        <span
                          className="archi-ext"
                          title="Its terminal is outside this web (Orca, another terminal, or a session from before a restart): you can watch it here, not type into it."
                        >
                          externo
                        </span>
                      ))}
                  </span>
                  <span className="archi-crew-proj" title={a.title ?? a.project}>
                    {a.parentId !== null ? `↳ ${a.parentName}` : (a.title ?? a.project)}
                  </span>
                </span>
              </span>
              <span className="archi-doing" title={STATE_LABEL[a.state]}>
                {a.activity}
              </span>
              <span
                className="archi-ctx"
                title={
                  a.context === null
                    ? 'Context not reported yet'
                    : `${Math.round(a.context * 100)}% of context used`
                }
              >
                {a.context !== null && (
                  <i
                    className={contextLevel(a.context)}
                    style={{ width: `${Math.round(Math.min(1, a.context) * 100)}%` }}
                  />
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
