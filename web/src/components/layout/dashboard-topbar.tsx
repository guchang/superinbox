"use client"

import { usePathname } from "@/i18n/navigation"
import { Header } from "@/components/layout/header"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function DashboardTopbar() {
  const pathname = usePathname()
  const isInboxDetailPage = pathname.startsWith("/inbox/") && pathname !== "/inbox"

  if (isInboxDetailPage) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center bg-white/50 px-3 backdrop-blur-xl dark:bg-[#0b0b0f]/50 md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Header />
      </div>
    </header>
  )
}
