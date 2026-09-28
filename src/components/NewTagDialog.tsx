import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { tags } from '../stores';

interface Props {
  onCancel: () => void;
  initialValue?: string;
  onSubmit?: (name: string) => void;
}

export const NewTagDialog = observer(({ onCancel, initialValue, onSubmit }: Props) => {
  const [name, setName] = useState(initialValue ?? '');

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) {
      if (onSubmit) onSubmit(trimmed);
      else tags.addLocalTag(trimmed);
    }
    onCancel();
  };

  const existing = tags.displayTree
    .flatMap((n) => [n.name, ...n.children.map((c) => `${n.name}/${c.name}`)])
    .filter(Boolean);

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{initialValue ? 'Rename tag' : 'New tag'}</h3>
        <p className="muted">Use "/" for hierarchy, e.g. people/alice</p>
        <input
          autoFocus
          list="existing-tags"
          data-testid="tag-name-input"
          value={name}
          placeholder="tag name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <datalist id="existing-tags">
          {existing.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <div className="dialog-actions">
          <button className="btn" data-testid="tag-submit" onClick={submit}>
            {initialValue ? 'Save' : 'Add'}
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});
