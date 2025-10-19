import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-helper";
import { useAdmin } from "@/hooks/useAdmin";
import { Loader2, LayoutDashboard, Users, Wallet, Calendar, Gamepad2, Radio, FileText, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Navbar } from "@/components/Navbar";
import { OverviewSection } from "@/components/admin/console/OverviewSection";
import { UsersSection } from "@/components/admin/console/UsersSection";
import { EconomySection } from "@/components/admin/console/EconomySection";
import { DailyRewardsSection } from "@/components/admin/console/DailyRewardsSection";
import { GamesSection } from "@/components/admin/console/GamesSection";
import { StreamElementsSection } from "@/components/admin/console/StreamElementsSection";
import { LogsSection } from "@/components/admin/console/LogsSection";
import { AdvancedSection } from "@/components/admin/console/AdvancedSection";

const menuItems = [
  { id: "overview", title: "Visão Geral", icon: LayoutDashboard },
  { id: "users", title: "Usuários & Contas", icon: Users },
  { id: "economy", title: "Economia", icon: Wallet },
  { id: "daily", title: "Diária", icon: Calendar },
  { id: "games", title: "Jogos", icon: Gamepad2 },
  { id: "streamelements", title: "StreamElements", icon: Radio },
  { id: "logs", title: "Logs & Auditoria", icon: FileText },
  { id: "advanced", title: "Avançado", icon: Settings },
];

export default function AdminConsole() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin, loading: adminLoading } = useAdmin(user);
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (!adminLoading && !isAdmin && !loading) {
      navigate("/");
    }
  }, [isAdmin, adminLoading, loading, navigate]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error("Error checking user:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection />;
      case "users":
        return <UsersSection />;
      case "economy":
        return <EconomySection />;
      case "daily":
        return <DailyRewardsSection />;
      case "games":
        return <GamesSection />;
      case "streamelements":
        return <StreamElementsSection />;
      case "logs":
        return <LogsSection />;
      case "advanced":
        return <AdvancedSection />;
      default:
        return <OverviewSection />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <SidebarProvider>
        <div className="flex min-h-[calc(100vh-64px)] w-full">
          <Sidebar className="border-r">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel className="text-lg font-bold px-4 py-4">
                  Console Admin
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {menuItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          onClick={() => setActiveSection(item.id)}
                          isActive={activeSection === item.id}
                          className="w-full"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-6">
              <div className="mb-6 flex items-center justify-between">
                <SidebarTrigger className="lg:hidden" />
                <h1 className="text-3xl font-bold">
                  {menuItems.find(item => item.id === activeSection)?.title}
                </h1>
              </div>
              
              {renderSection()}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
