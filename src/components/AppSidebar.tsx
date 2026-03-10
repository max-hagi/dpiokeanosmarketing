import { LayoutDashboard, PenSquare, History, Waves, Users, MessageCircle, GitBranch, Brain, Mail } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const contentNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/create", icon: PenSquare, label: "Create Content" },
  { to: "/history", icon: History, label: "History" },
];

const leadNavItems = [
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/leads/pipeline", icon: GitBranch, label: "Pipeline" },
  { to: "/leads/capture", icon: MessageCircle, label: "Start Conversation" },
  { to: "/crm", icon: Brain, label: "CRM & Actions" },
  { to: "/follow-up", icon: Mail, label: "Follow-Up Sequences" },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
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
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/30">Content</p>
        {contentNavItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary/15 text-sidebar-primary shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-sidebar-primary")} />
              {item.label}
            </NavLink>
          );
        })}

        <div className="my-4 mx-3 border-t border-sidebar-border/50" />

        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/30">Leads</p>
        {leadNavItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to === "/leads" && location.pathname.startsWith("/leads/") && location.pathname !== "/leads/capture" && location.pathname !== "/leads/pipeline") ||
            (item.to === "/crm" && location.pathname.startsWith("/crm/")) ||
            (item.to === "/follow-up" && location.pathname.startsWith("/follow-up/"));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary/15 text-sidebar-primary shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-sidebar-primary")} />
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
