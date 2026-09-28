import * as fs from 'fs/promises';
import { Sidecar } from '../shared/types';
import { emptySidecar, sidecarFromJson, sidecarToJson } from '../shared/sidecar';

export function sidecarPathFor(videoPath: string): string {
  return `${videoPath}.tags.json`;
}

export async function loadSidecar(videoPath: string): Promise<Sidecar> {
  try {
    const content = await fs.readFile(sidecarPathFor(videoPath), 'utf-8');
    return sidecarFromJson(content);
  } catch {
    return emptySidecar();
  }
}

export async function saveSidecar(videoPath: string, sidecar: Sidecar): Promise<void> {
  const target = sidecarPathFor(videoPath);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, sidecarToJson(sidecar), 'utf-8');
  await fs.rename(tmp, target);
}
