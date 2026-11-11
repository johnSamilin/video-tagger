export const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.oga', '.opus', '.wma', '.aif', '.aiff',
]);

export function isAudioFile(filePath: string): boolean {
  return AUDIO_EXTENSIONS.has(filePath.slice(filePath.lastIndexOf('.')).toLowerCase());
}
