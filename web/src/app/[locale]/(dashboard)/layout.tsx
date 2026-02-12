import { AppSidebar } from '@/components/layout/sidebar'
import { DashboardTopbar } from '@/components/layout/dashboard-topbar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

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
            <DashboardTopbar />
            {children}
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  )
}
