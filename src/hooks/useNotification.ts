'use client';

import { useEffect, useCallback, useState } from 'react';

export function useNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch {
      return false;
    }
  }, []);

  const notify = useCallback((title: string, options?: NotificationOptions) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.hasFocus()) return; // Don't notify if tab is focused

    try {
      const notification = new Notification(title, {
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: 'purrdrop',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch {
      // Notification failed, ignore
    }
  }, []);

  const notifyFileOffer = useCallback((fromName: string, fileName: string) => {
    notify(`${fromName} ส่งไฟล์มาให้`, {
      body: fileName,
      tag: 'file-offer',
    });
  }, [notify]);

  const notifyTransferComplete = useCallback((fileName: string, direction: 'sent' | 'received') => {
    notify(
      direction === 'sent' ? 'ส่งไฟล์สำเร็จ!' : 'รับไฟล์สำเร็จ!',
      { body: fileName, tag: 'transfer-complete' }
    );
  }, [notify]);

  const notifyPeerJoined = useCallback((peerName: string) => {
    notify('มีเพื่อนเข้ามา!', {
      body: `${peerName} เข้าร่วมแล้ว`,
      tag: 'peer-joined',
    });
  }, [notify]);

  return {
    permission,
    requestPermission,
    notify,
    notifyFileOffer,
    notifyTransferComplete,
    notifyPeerJoined,
  };
}
