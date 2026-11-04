import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Установка и обновление приложения.
 * Android / компьютер (Chrome, Edge): кнопка «Установить».
 * iPhone / iPad (Safari): подсказка «Поделиться → На экран „Домой“» —
 * у Safari нет кнопки установки, которую можно вызвать из страницы.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

const DISMISS_KEY = 'install-hint-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  if (isStandalone() || dismissed) return null;

  const hide = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* приватный режим */
    }
  };

  if (deferredPrompt) {
    return (
      <div className="banner">
        <span>📲 Установите приложение — оно будет открываться с экрана и работать без интернета.</span>
        <span className="spacer" />
        <button
          className="btn small accent"
          onClick={async () => {
            await deferredPrompt?.prompt();
            deferredPrompt = null;
            force((n) => n + 1);
          }}
        >
          Установить
        </button>
        <button className="icon-btn" aria-label="Скрыть" onClick={hide}>
          ×
        </button>
      </div>
    );
  }

  if (isIOS()) {
    return (
      <div className="banner">
        <span>
          📲 Чтобы установить на iPhone или iPad: откройте в Safari, нажмите <b>«Поделиться»</b> (квадрат со стрелкой) и выберите <b>«На экран „Домой“»</b>.
        </span>
        <button className="icon-btn" aria-label="Скрыть" onClick={hide}>
          ×
        </button>
      </div>
    );
  }

  return null;
}

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Проверяем обновления раз в час, пока приложение открыто
      if (reg) window.setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="banner" style={{ margin: '12px 16px 0' }}>
      <span>Доступна новая версия приложения.</span>
      <span className="spacer" />
      <button className="btn small accent" onClick={() => void updateServiceWorker(true)}>
        Обновить
      </button>
    </div>
  );
}
