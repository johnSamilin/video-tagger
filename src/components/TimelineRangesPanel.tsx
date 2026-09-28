import { useCallback, useEffect, useRef } from 'react';
import { observer, useLocalObservable } from 'mobx-react-lite';
import { autorun } from 'mobx';
import { TimeRange } from '../types';
import { player, sidecar, tags } from '../stores';
import { colorFor } from '../lib/colors';
import { formatTimeShort } from '../lib/time';
import { RangeEditDialog } from './RangeEditDialog';

const LANE_HEIGHT = 28;
const LABEL_WIDTH = 110;
const HANDLE = 6;

type Selection = { tag: string; index: number };

type DragState = {
  tag: string;
  index: number;
  mode: 'move' | 'resize-l' | 'resize-r' | 'create';
  startX: number;
  startTime: number;
  orig: TimeRange;
  preview: TimeRange;
};

function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => {
    const v = cs.getPropertyValue(name).trim();
    return v || fallback;
  };
  return {
    bg: get('--tl-bg', '#fafafa'),
    lane: get('--tl-lane', '#e9e7e3'),
    label: get('--tl-label', '#77767b'),
    playhead: get('--tl-playhead', '#e01b24'),
    outline: get('--tl-range-border', '#241f31'),
    fontUi: get('--font-ui', 'system-ui'),
  };
}

export const TimelineRangesPanel = observer(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ui = useLocalObservable(() => ({
    selected: null as Selection | null,
    editing: null as (Selection & { range: TimeRange }) | null,
    drag: null as DragState | null,
  }));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const duration = player.duration;
    const width = container.clientWidth;

    const allTags = [...sidecar.sortedTags];
    for (const tag of tags.pending.keys()) {
      if (!allTags.includes(tag)) allTags.push(tag);
    }

    const height = allTags.length * LANE_HEIGHT;
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const laneW = width - LABEL_WIDTH - 16;
    const laneX = LABEL_WIDTH;
    const timeToX = (t: number) => laneX + (duration > 0 ? (t / duration) * laneW : 0);

    const c = themeColors();

    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, width, height);

    allTags.forEach((tag, i) => {
      const y = i * LANE_HEIGHT;

      ctx.fillStyle = c.label;
      ctx.font = `12px ${c.fontUi}`;
      ctx.textAlign = 'right';
      ctx.fillText(tag, LABEL_WIDTH - 8, y + LANE_HEIGHT / 2 + 4);

      ctx.fillStyle = c.lane;
      ctx.fillRect(laneX, y + 4, laneW, LANE_HEIGHT - 8);

      const ranges = sidecar.rangesFor(tag);
      ranges.forEach((r, idx) => {
        const x0 = timeToX(r.start);
        const x1 = timeToX(r.end);
        const isSelected = ui.selected?.tag === tag && ui.selected.index === idx;
        ctx.fillStyle = colorFor(tag);
        ctx.globalAlpha = isSelected ? 0.95 : 0.7;
        ctx.fillRect(x0, y + 4, Math.max(2, x1 - x0), LANE_HEIGHT - 8);
        ctx.globalAlpha = 1;
        if (isSelected) {
          ctx.strokeStyle = c.outline;
          ctx.lineWidth = 2;
          ctx.strokeRect(x0, y + 4, Math.max(2, x1 - x0), LANE_HEIGHT - 8);
        }
      });

      if (tags.pending.has(tag)) {
        const start = tags.pending.get(tag) as number;
        const x0 = timeToX(start);
        const x1 = timeToX(player.currentTime);
        ctx.fillStyle = colorFor(tag);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(Math.min(x0, x1), y + 4, Math.abs(x1 - x0), LANE_HEIGHT - 8);
        ctx.globalAlpha = 1;
      }

      if (ui.drag && ui.drag.tag === tag) {
        const p = ui.drag.preview;
        const x0 = timeToX(p.start);
        const x1 = timeToX(p.end);
        ctx.strokeStyle = c.outline;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.strokeRect(x0, y + 4, Math.max(2, x1 - x0), LANE_HEIGHT - 8);
        ctx.setLineDash([]);
      }
    });

    if (duration > 0) {
      const px = timeToX(player.currentTime);
      ctx.strokeStyle = c.playhead;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads live MobX observables via stable closures

  useEffect(() => {
    const dispose = autorun(() => draw());
    const onResize = () => draw();
    window.addEventListener('resize', onResize);

    const observer = new MutationObserver(() => draw());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      dispose();
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, [draw]);

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const laneInfo = (x: number, y: number) => {
    const duration = player.duration;
    const width = containerRef.current?.clientWidth ?? 0;
    const laneW = width - LABEL_WIDTH - 16;
    const laneX = LABEL_WIDTH;
    const index = Math.floor(y / LANE_HEIGHT);
    const allTags = [...sidecar.sortedTags];
    for (const tag of tags.pending.keys()) {
      if (!allTags.includes(tag)) allTags.push(tag);
    }
    const tag = allTags[index];
    const time = laneW > 0 ? ((x - laneX) / laneW) * duration : 0;
    return { tag, index, time, laneX, laneW };
  };

  const findRange = (
    x: number,
    y: number,
  ): (Selection & { range: TimeRange; mode: 'move' | 'resize-l' | 'resize-r' }) | null => {
    const { tag, laneX, laneW } = laneInfo(x, y);
    if (!tag) return null;
    const duration = player.duration;
    const timeToX = (t: number) => laneX + (duration > 0 ? (t / duration) * laneW : 0);
    const ranges = sidecar.rangesFor(tag);
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const x0 = timeToX(r.start);
      const x1 = timeToX(r.end);
      if (x >= x0 - HANDLE && x <= x1 + HANDLE) {
        if (x < x0 + HANDLE) return { tag, index: i, range: r, mode: 'resize-l' };
        if (x > x1 - HANDLE) return { tag, index: i, range: r, mode: 'resize-r' };
        return { tag, index: i, range: r, mode: 'move' };
      }
    }
    return null;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!player.currentVideoPath || player.duration <= 0) return;
    const { x, y } = getPos(e);
    const { tag, time } = laneInfo(x, y);
    if (!tag) return;

    const hit = findRange(x, y);
    if (hit) {
      ui.selected = { tag: hit.tag, index: hit.index };
      ui.drag = {
        tag: hit.tag,
        index: hit.index,
        mode: hit.mode,
        startX: x,
        startTime: time,
        orig: { ...hit.range },
        preview: { ...hit.range },
      };
    } else {
      ui.selected = null;
      ui.drag = {
        tag,
        index: -1,
        mode: 'create',
        startX: x,
        startTime: time,
        orig: { start: time, end: time },
        preview: { start: time, end: time },
      };
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!ui.drag) return;
    const { x, y } = getPos(e);
    const { time } = laneInfo(x, y);
    const dt = time - ui.drag.startTime;
    const { mode, orig } = ui.drag;

    if (mode === 'move') {
      const len = orig.end - orig.start;
      let start = orig.start + dt;
      if (start < 0) start = 0;
      if (start + len > player.duration) start = player.duration - len;
      ui.drag.preview = { start, end: start + len };
    } else if (mode === 'resize-l') {
      const start = Math.max(0, Math.min(orig.start + dt, orig.end - 0.1));
      ui.drag.preview = { start, end: orig.end };
    } else if (mode === 'resize-r') {
      const end = Math.min(player.duration, Math.max(orig.end + dt, orig.start + 0.1));
      ui.drag.preview = { start: orig.start, end };
    } else if (mode === 'create') {
      const start = ui.drag.startTime;
      const end = time;
      ui.drag.preview = { start: Math.min(start, end), end: Math.max(start, end) };
    }
  };

  const onMouseUp = () => {
    const drag = ui.drag;
    if (!drag) return;
    const { mode, tag, index, preview } = drag;
    if (mode === 'create') {
      if (preview.end - preview.start > 0.1) {
        sidecar.addRange(tag, { start: preview.start, end: preview.end });
      }
    } else if (index >= 0) {
      sidecar.updateRange(tag, index, { start: preview.start, end: preview.end });
    }
    ui.drag = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = getPos(e);
    const hit = findRange(x, y);
    if (hit) {
      player.seek(hit.range.start);
    }
  };

  return (
    <div className="timeline">
      <div className="timeline-head">
        <span>Ranges</span>
        <span className="muted">drag to create, drag edges to resize, double-click to seek</span>
      </div>
      <div className="canvas-wrap" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDoubleClick}
        />
      </div>
      <div className="range-list">
        {sidecar.sortedTags.map((tag) =>
          sidecar.rangesFor(tag).map((r, i) => (
            <div className="range-row" key={`${tag}-${i}`} data-testid="range-row" data-name={tag}>
              <span className="swatch" style={{ background: colorFor(tag) }} />
              <span className="tag-name">{tag}</span>
              <span className="muted">
                {formatTimeShort(r.start)} – {formatTimeShort(r.end)}
              </span>
              <button
                className="btn small"
                onClick={() => (ui.editing = { tag, index: i, range: r })}
              >
                Edit
              </button>
              <button className="btn small" onClick={() => sidecar.deleteRange(tag, i)}>
                Delete
              </button>
            </div>
          )),
        )}
        {sidecar.sortedTags.length === 0 && (
          <div className="muted">No ranges yet. Click a tag on the left to start marking.</div>
        )}
      </div>
      {ui.editing && (
        <RangeEditDialog
          initial={ui.editing.range}
          onSave={(range) => {
            sidecar.updateRange(ui.editing!.tag, ui.editing!.index, range);
            ui.editing = null;
          }}
          onDelete={() => {
            sidecar.deleteRange(ui.editing!.tag, ui.editing!.index);
            ui.editing = null;
          }}
          onCancel={() => (ui.editing = null)}
        />
      )}
    </div>
  );
});
