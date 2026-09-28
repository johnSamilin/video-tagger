import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { TimeRange } from '../types';
import { player } from '../stores';
import { formatTime, parseTime } from '../lib/time';

interface Props {
  initial: TimeRange;
  onSave: (range: TimeRange) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export const RangeEditDialog = observer(({ initial, onSave, onDelete, onCancel }: Props) => {
  const [start, setStart] = useState(formatTime(initial.start));
  const [end, setEnd] = useState(formatTime(initial.end));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const s = parseTime(start);
    const e = parseTime(end);
    if (Number.isNaN(s) || Number.isNaN(e)) {
      setError('Invalid time format (HH:MM:SS)');
      return;
    }
    if (e <= s) {
      setError('End must be greater than start');
      return;
    }
    onSave({ start: s, end: e });
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Edit range</h3>
        <div className="field">
          <label>Start</label>
          <input value={start} onChange={(e) => setStart(e.target.value)} />
          <button className="btn small" onClick={() => setStart(formatTime(player.currentTime))}>
            Use current position
          </button>
        </div>
        <div className="field">
          <label>End</label>
          <input value={end} onChange={(e) => setEnd(e.target.value)} />
          <button className="btn small" onClick={() => setEnd(formatTime(player.currentTime))}>
            Use current position
          </button>
        </div>
        {error && <div className="query-error">{error}</div>}
        <div className="dialog-actions">
          <button className="btn" onClick={submit}>
            Save
          </button>
          <button className="btn danger" onClick={onDelete}>
            Delete
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});
