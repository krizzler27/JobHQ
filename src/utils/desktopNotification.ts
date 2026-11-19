/**
 * Bridge for native OS desktop notifications via Tauri,
 * with automatic fallback to in-app toast notifications in browser mode.
 */

export interface DesktopNotificationOptions {
  title: string;
  body: string;
  icon?: string;
}

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

export const sendDesktopNotification = async (options: DesktopNotificationOptions): Promise<boolean> => {
  if (!isTauriEnvironment()) {
    return false;
  }

  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import(
      '@tauri-apps/plugin-notification'
    );

    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }

    if (permissionGranted) {
      sendNotification({
        title: options.title,
        body: options.body,
      });
      return true;
    }
  } catch (err) {
    console.warn('[DesktopNotification] Failed to dispatch OS notification:', err);
  }

  return false;
};
