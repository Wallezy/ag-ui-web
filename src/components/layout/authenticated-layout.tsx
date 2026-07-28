import { Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <SkipToMain />
      <AppSidebar />
      <SidebarInset className='@container/content has-data-[layout=fixed]:h-svh'>
        {children ?? <Outlet />}
      </SidebarInset>
    </SidebarProvider>
  )
}
