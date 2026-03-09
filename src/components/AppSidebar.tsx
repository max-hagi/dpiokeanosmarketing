import { LayoutDashboard, PenSquare, History, Waves, Users, UserPlus } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/create", icon: PenSquare, label: "Create Content" },
  { to: "/history", icon: History, label: "History" },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
          <Waves className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-bold text-sidebar-primary-foreground">Okeanos</h1>
          <p className="text-xs text-sidebar-foreground/60">Marketing Agent</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40">Okeanos Ontario © 2026</p>
      </div>
    </aside>
  );
}
