import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { tags, videoTree } from '../stores';
import { runQuery } from '../lib/query';

export const QueryPanel = observer(() => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [untagged, setUntagged] = useState(false);

  const applyUntagged = () => {
    const tagged = new Set(tags.allVideoPaths);
    const paths = new Set(videoTree.allVideoPaths.filter((p) => !tagged.has(p)));
    videoTree.applyFilter(paths);
    setMatchCount(paths.size);
  };

  const handleQueryChange = (query: string) => {
    setValue(query);
    if (query.trim()) {
      setUntagged(false);
      try {
        const result = runQuery(query, tags.index, tags.allVideoPaths);
        videoTree.applyFilter(result);
        setError(null);
        setMatchCount(result.size);
      } catch (e) {
        setError((e as Error).message);
        setMatchCount(null);
      }
    } else if (!untagged) {
      videoTree.applyFilter(null);
      setMatchCount(null);
      setError(null);
    }
  };

  const toggleUntagged = () => {
    const next = !untagged;
    setUntagged(next);
    if (next) {
      setValue('');
      setError(null);
      applyUntagged();
    } else {
      videoTree.applyFilter(null);
      setMatchCount(null);
    }
  };

  const clear = () => {
    setValue('');
    setUntagged(false);
    setError(null);
    setMatchCount(null);
    videoTree.applyFilter(null);
  };

  return (
    <div className="query-bar">
      <button
        className={`btn small${untagged ? ' primary' : ''}`}
        data-testid="untagged-filter"
        title="Show only videos without any tags"
        onClick={toggleUntagged}
      >
        Untagged
      </button>
      <input
        className="query-input"
        data-testid="query-input"
        placeholder="Search: e.g. family and travel, (a or b) and not c"
        value={value}
        onChange={(e) => handleQueryChange(e.target.value)}
      />
      {matchCount !== null && <span className="query-count">{matchCount} videos</span>}
      {error && <span className="query-error">{error}</span>}
      <button className="btn" onClick={clear}>
        Clear
      </button>
    </div>
  );
});
