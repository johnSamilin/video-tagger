import { observer } from 'mobx-react-lite';
import { query } from '../stores';

export const QueryPanel = observer(() => {
  const { query: value, error, matchCount, untagged } = query;

  return (
    <div className="query-bar">
      <button
        className={`btn small${untagged ? ' primary' : ''}`}
        data-testid="untagged-filter"
        title="Show only videos without any tags"
        onClick={() => query.toggleUntagged()}
      >
        Untagged
      </button>
      <input
        className="query-input"
        data-testid="query-input"
        placeholder="Search: e.g. family and travel, (a or b) and not c"
        value={value}
        onChange={(e) => query.setQuery(e.target.value)}
      />
      {matchCount !== null && <span className="query-count">{matchCount} videos</span>}
      {error && <span className="query-error">{error}</span>}
      <button className="btn" onClick={() => query.clear()}>
        Clear
      </button>
    </div>
  );
});
