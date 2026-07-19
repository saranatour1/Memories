import { Outlet } from "react-router";
import { useAuthKitUser } from "~/lib/auth";
import { AppSidebar } from "~/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

export default function AppLayout() {
  const user = useAuthKitUser();
  // Signed-out pages (the marketing home) render bare, without the sidebar.
  if (!user) return <Outlet />;
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 px-4">
            <SidebarTrigger />
          </header>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
