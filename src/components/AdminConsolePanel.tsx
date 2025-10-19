import { useState, Suspense, lazy } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutDashboard, Users, Wallet, Calendar, Gamepad2, Radio, FileText, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Lazy load sections
const OverviewSection = lazy(() => import("./admin/console/OverviewSection").then(m => ({ default: m.OverviewSection })));
const UsersSection = lazy(() => import("./admin/console/UsersSection").then(m => ({ default: m.UsersSection })));
const EconomySection = lazy(() => import("./admin/console/EconomySection").then(m => ({ default: m.EconomySection })));
const DailyRewardsSection = lazy(() => import("./admin/console/DailyRewardsSection").then(m => ({ default: m.DailyRewardsSection })));
const GamesSection = lazy(() => import("./admin/console/GamesSection").then(m => ({ default: m.GamesSection })));
const StreamElementsSection = lazy(() => import("./admin/console/StreamElementsSection").then(m => ({ default: m.StreamElementsSection })));
const LogsSection = lazy(() => import("./admin/console/LogsSection").then(m => ({ default: m.LogsSection })));
const AdvancedSection = lazy(() => import("./admin/console/AdvancedSection").then(m => ({ default: m.AdvancedSection })));

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

interface AdminConsolePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminConsolePanel({ open, onOpenChange }: AdminConsolePanelProps) {
  const [activeSection, setActiveSection] = useState("overview");
  const { status, isAdmin } = useAuth();

  const renderSection = () => {
    if (status !== 'ready' || !isAdmin) {
      return <Skeleton className="h-64 w-full" />;
    }

    const sections: Record<string, JSX.Element> = {
      overview: <OverviewSection />,
      users: <UsersSection />,
      economy: <EconomySection />,
      daily: <DailyRewardsSection />,
      games: <GamesSection />,
      streamelements: <StreamElementsSection />,
      logs: <LogsSection />,
      advanced: <AdvancedSection />,
    };

    return sections[activeSection] || <div>Seção não encontrada</div>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-6xl max-h-[90vh] overflow-y-auto"
        aria-describedby="admin-console-description"
      >
        <DialogTitle>Console de Administração</DialogTitle>
        <DialogDescription id="admin-console-description">
          Gerencie todas as configurações do sistema
        </DialogDescription>

        <div className="space-y-6">
          {/* Menu de navegação */}
          <div className="flex gap-2 flex-wrap">
            {menuItems.map((item) => (
              <Button
                key={item.id}
                variant={activeSection === item.id ? "default" : "outline"}
                onClick={() => setActiveSection(item.id)}
                className="flex items-center gap-2"
                size="sm"
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Button>
            ))}
          </div>

          {/* Conteúdo com Suspense */}
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            {renderSection()}
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}
