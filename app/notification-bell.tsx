"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import type { NotificationListResponse } from "./lib/types";

function formatNotificationTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function NotificationBell({
  dogId,
  buttonClassName,
  panelClassName,
  iconSize = 20,
  title = "공유 알림"
}: {
  dogId?: string;
  buttonClassName: string;
  panelClassName: string;
  iconSize?: number;
  title?: string;
}) {
  const { api } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<NotificationListResponse>({ notifications: [], unreadCount: 0 });
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    const query = new URLSearchParams({ limit: "20" });

    if (dogId) {
      query.set("dogId", dogId);
    }

    const nextPayload = await api<NotificationListResponse>(`/api/notifications?${query.toString()}`);
    setPayload(nextPayload);
    setError("");
  }, [api, dogId]);

  useEffect(() => {
    loadNotifications().catch(() => {
      setPayload({ notifications: [], unreadCount: 0 });
    });
  }, [loadNotifications]);

  async function toggleOpen() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (!nextOpen) {
      return;
    }

    try {
      await loadNotifications();
      await api("/api/notifications/read", {
        method: "PATCH",
        body: JSON.stringify({ dogId })
      });
      setPayload((current) => ({
        ...current,
        unreadCount: 0,
        notifications: current.notifications.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString()
        }))
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "알림을 불러오지 못했어요.");
    }
  }

  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        aria-label={title}
        className={buttonClassName}
        onClick={toggleOpen}
        type="button"
      >
        <Bell size={iconSize} strokeWidth={2} />
        {payload.unreadCount > 0 && (
          <span className="absolute right-[2px] top-[2px] h-[8px] w-[8px] rounded-full bg-ms-warn-fg" />
        )}
      </button>

      {isOpen ? (
        <section className={panelClassName}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold leading-none">{title}</h2>
            {payload.unreadCount > 0 && (
              <span className="rounded-full bg-ms-warn-bg px-[8px] py-[3px] text-[10px] font-extrabold text-ms-warn-fg">
                {payload.unreadCount}
              </span>
            )}
          </div>
          {error ? (
            <p className="mt-[10px] rounded-[14px] bg-ms-warn-bg px-[12px] py-[12px] text-[12px] font-bold text-ms-warn-fg">
              {error}
            </p>
          ) : payload.notifications.length === 0 ? (
            <p className="mt-[10px] rounded-[16px] bg-ms-sunken px-[12px] py-[16px] text-center text-[12px] font-bold text-ms-muted">
              아직 새로운 알림이 없어요.
            </p>
          ) : (
            <div className="mt-[10px] grid max-h-[300px] gap-[8px] overflow-y-auto">
              {payload.notifications.map((notification) => (
                <article className="rounded-[14px] bg-ms-sunken px-[12px] py-[10px]" key={notification.id}>
                  <div className="flex items-start justify-between gap-[8px]">
                    <strong className="text-[12px] font-extrabold leading-[1.35] text-ms-ink">
                      {notification.title}
                    </strong>
                    {!notification.readAt && <span className="mt-[3px] h-[7px] w-[7px] shrink-0 rounded-full bg-ms-brand" />}
                  </div>
                  <p className="mt-[5px] text-[11px] font-semibold leading-[1.45] text-ms-secondary">
                    {notification.message}
                  </p>
                  <p className="mt-[6px] text-[10px] font-bold text-ms-muted">
                    {formatNotificationTime(notification.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
