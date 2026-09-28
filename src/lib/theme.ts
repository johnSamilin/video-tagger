export interface ThemeDef {
  id: string;
  name: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'gnome', name: 'GNOME' },
  { id: 'teenage-engineering', name: 'Teenage Engineering' },
];

const STORAGE_KEY = 'video-tagger-theme';
const DEFAULT_THEME = 'gnome';

export function applyTheme(id: string) {
  document.documentElement.setAttribute('data-theme', id);
}

export function getTheme(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function setTheme(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore persistence errors
  }
  applyTheme(id);
}

export function initTheme() {
  applyTheme(getTheme());
}
