import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

export interface AppConfig {
  rootPath: string | null;
}

function configFile(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    if (existsSync(configFile())) {
      const raw = await fs.readFile(configFile(), 'utf-8');
      const data = JSON.parse(raw);
      return { rootPath: typeof data.rootPath === 'string' ? data.rootPath : null };
    }
  } catch {
    // ignore corrupt config
  }
  return { rootPath: null };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(path.dirname(configFile()), { recursive: true });
  await fs.writeFile(configFile(), JSON.stringify(config, null, 2), 'utf-8');
}
