import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { videoTree } from '../stores';
import { THEMES, getTheme, setTheme } from '../lib/theme';

export const HeaderBar = observer(() => {
  const [theme, setThemeState] = useState(getTheme());

  return (
    <header className="header">
      <div className="brand">Video Tagger</div>
      <button className="btn primary" onClick={() => videoTree.selectRoot()}>
        Open root folder…
      </button>
      <div className="root-path">{videoTree.rootPath ?? 'No root selected'}</div>
      <select
        className="theme-select"
        data-testid="theme-select"
        value={theme}
        onChange={(e) => {
          const id = e.target.value;
          setTheme(id);
          setThemeState(id);
        }}
        title="Theme"
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </header>
  );
});
