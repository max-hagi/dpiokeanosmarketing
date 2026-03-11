import { LayoutDashboard, Target, Users, Palette, Settings, Waves, MessageSquare } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/pipeline", icon: Target, label: "Pipeline" },
  { to: "/crm", icon: Users, label: "CRM" },
  { to: "/marketing", icon: Palette, label: "Marketing" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function AppSidebar() {
  const location = useLocation();

  const isActive = (to: string) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-accent shadow-md">
          <Waves className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-bold text-sidebar-primary-foreground tracking-tight">Okeanos</h1>
          <p className="text-[11px] text-sidebar-foreground/50 font-medium">Marketing Agent</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-sidebar-primary/15 text-sidebar-primary shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", active && "text-sidebar-primary")} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-[11px] text-sidebar-foreground/30 font-medium">Okeanos Ontario © 2026</p>
      </div>
    </aside>
  );
}
