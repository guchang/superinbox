import { AppSidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Inbox } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex h-svh flex-1 min-w-0 flex-col w-full">
        <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-black/[0.03] dark:border-white/[0.03] bg-white/50 dark:bg-[#0b0b0f]/50 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground shadow-lg">
              <Inbox className="h-4 w-4" />
            </div>
            <span className="font-black text-sm tracking-tight uppercase">SuperInbox</span>
          </div>
          <Header />
        </header>
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <AppSidebar className="top-14 h-[calc(100svh-3.5rem)]" />
          <SidebarInset className="flex-1 overflow-y-auto overflow-x-hidden bg-background/50">
            {children}
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  )
}
