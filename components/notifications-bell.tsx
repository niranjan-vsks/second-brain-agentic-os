"use client"

import useSWR from "swr"
import { useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getNotifications, markAllNotificationsRead } from "@/app/actions/linkedin"
import type { AppNotification } from "@/lib/types"

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const { data: notifications, mutate } = useSWR<AppNotification[]>("notifications", () => getNotifications(), {
    refreshInterval: 30000,
  })

  const unread = notifications?.filter((n) => !n.read) ?? []

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && unread.length > 0) {
      await markAllNotificationsRead()
      mutate()
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
        <Bell className="size-4" aria-hidden="true" />
        <span className="sr-only">Notifications</span>
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="flex flex-col">
              {notifications.slice(0, 20).map((n) => (
                <li key={n.id} className="border-b border-border/50 px-3 py-2.5 last:border-b-0">
                  <p className="text-sm leading-snug text-pretty">{n.message}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
