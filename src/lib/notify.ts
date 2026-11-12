"use client";

import { toast } from "sonner";
import { playSound, type SoundName } from "./sound";

/**
 * Notificaciones de RLS Tools: aviso dentro de la app (con sonido) y, si la app
 * está en segundo plano y el usuario lo permitió, notificación del sistema.
 */
const KEY = "rls-notify";
const EVENT = "rls-notify-change";

export type NotifyPermission = "granted" | "denied" | "default" | "unsupported";

export function notifyPermission(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** El usuario quiere avisos del sistema (además de tener el permiso del navegador). */
export function systemNotificationsOn() {
  try {
    return notifyPermission() === "granted" && localStorage.getItem(KEY) !== "off";
  } catch {
    return false;
  }
}

export function subscribeNotify(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export async function enableSystemNotifications(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Sin almacenamiento: queda como esté el permiso
  }
  if (on && notifyPermission() === "default") await Notification.requestPermission();
  window.dispatchEvent(new Event(EVENT));
  return systemNotificationsOn();
}

type Notice = { title: string; body?: string; href?: string; tag?: string; tone?: "info" | "success" | "error" };

const SOUND: Record<NonNullable<Notice["tone"]>, SoundName> = { info: "notify", success: "success", error: "error" };

export async function notify({ title, body, href, tag, tone = "info" }: Notice) {
  playSound(SOUND[tone]);
  navigator.vibrate?.(tone === "error" ? [80, 60, 80] : 60);
  const show = tone === "error" ? toast.error : tone === "success" ? toast.success : toast.info;
  show(title, { description: body, action: href ? { label: "Ver", onClick: () => location.assign(href) } : undefined });

  // En segundo plano (otra app o pantalla apagada): notificación del sistema
  if (document.visibilityState === "visible" || !systemNotificationsOn()) return;
  const options: NotificationOptions = { body, tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { href: href ?? "/" } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    // Algunos navegadores no permiten notificar desde aquí: queda el aviso en la app
  }
}
