export function prepareProtocolWindow(): Window | null {
  const protocolWindow = window.open('', '_blank');

  if (!protocolWindow) {
    return null;
  }

  protocolWindow.opener = null;

  try {
    protocolWindow.document.title = 'Cargando protocolo';
    protocolWindow.document.body.innerHTML = [
      '<main style="font-family: Inter, system-ui, sans-serif;',
      'min-height: 100vh; display: grid; place-items: center;',
      'margin: 0; color: #111827; background: #f8fafc;">',
      '<p style="font-size: 16px;">Cargando protocolo...</p>',
      '</main>',
    ].join('');
  } catch {
    // La ventana preabierta puede quedar sin acceso al documento segun el navegador.
  }

  return protocolWindow;
}

export function openUrlInProtocolWindow(
  protocolWindow: Window | null,
  url: string,
): boolean {
  if (protocolWindow && !protocolWindow.closed) {
    protocolWindow.location.href = url;
    return true;
  }

  return Boolean(window.open(url, '_blank', 'noopener,noreferrer'));
}

export function closeProtocolWindow(protocolWindow: Window | null): void {
  if (protocolWindow && !protocolWindow.closed) {
    protocolWindow.close();
  }
}
