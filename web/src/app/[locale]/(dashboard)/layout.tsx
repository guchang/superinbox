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
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex-1 overflow-y-auto overflow-x-hidden bg-background/50">
            <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center bg-white/50 dark:bg-[#0b0b0f]/50 px-3 md:px-6 backdrop-blur-xl relative">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Header />
              </div>
            </header>
            {children}
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  )
}
