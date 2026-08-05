const MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
};

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

function fileNameFromPath(path) {
  return String(path || '').split(/[\\/]/).pop() || 'Attached file';
}

function mimeFromPath(path) {
  const name = fileNameFromPath(path).toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? MIME_BY_EXTENSION[name.slice(dot)] || 'application/octet-stream' : 'application/octet-stream';
}

// Browser drag events expose File objects. Tauri's native WebView instead
// emits filesystem paths, so convert those paths into the same File shape used
// by the existing encrypted media pipeline.
export async function subscribeToNativeFileDrop(onDrop) {
  if (!isTauriRuntime()) return () => {};
  try {
    const [{ getCurrentWindow }, { readFile }] = await Promise.all([
      import('@tauri-apps/api/window'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const windowHandle = getCurrentWindow();
    return await windowHandle.onDragDropEvent(async (event) => {
      if (event.payload?.type !== 'drop') return;
      const paths = Array.isArray(event.payload.paths) ? event.payload.paths : [];
      const files = [];
      for (const path of paths) {
        try {
          const bytes = await readFile(path);
          files.push(new File([bytes], fileNameFromPath(path), { type: mimeFromPath(path) }));
        } catch (error) {
          console.warn('Could not read dropped file:', path, error);
        }
      }
      if (files.length) onDrop(files, event.payload.position || null);
    });
  } catch (error) {
    console.warn('Native file drop is unavailable:', error);
    return () => {};
  }
}

