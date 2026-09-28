import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { tags, videoTree } from '../stores';
import { runQuery } from '../lib/query';

export const QueryPanel = observer(() => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);

  const apply = (query: string) => {
    if (!query.trim()) {
      videoTree.applyFilter(null);
      setError(null);
      setMatchCount(null);
      return;
    }
    try {
      const result = runQuery(query, tags.index, tags.allVideoPaths);
      videoTree.applyFilter(result);
      setError(null);
      setMatchCount(result.size);
    } catch (e) {
      setError((e as Error).message);
      setMatchCount(null);
    }
  };

  const clear = () => {
    setValue('');
    apply('');
  };

  return (
    <div className="query-bar">
      <input
        className="query-input"
        data-testid="query-input"
        placeholder="Search: e.g. family and travel, (a or b) and not c"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          apply(e.target.value);
        }}
      />
      {matchCount !== null && <span className="query-count">{matchCount} videos</span>}
      {error && <span className="query-error">{error}</span>}
      <button className="btn" onClick={clear}>
        Clear
      </button>
    </div>
  );
});
