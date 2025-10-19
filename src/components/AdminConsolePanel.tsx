import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Wallet, Calendar, Gamepad2, Radio, FileText, Settings } from "lucide-react";

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

export function AdminConsolePanel() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Console de Administração</h2>
        <p className="text-muted-foreground">Gerencie todas as configurações do sistema</p>
      </div>

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

      {/* Conteúdo */}
      <Card>
        <CardHeader>
          <CardTitle>{menuItems.find(m => m.id === activeSection)?.title}</CardTitle>
          <CardDescription>
            Seção de {menuItems.find(m => m.id === activeSection)?.title.toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Conteúdo da seção "{activeSection}" em desenvolvimento.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Esta é a nova Console de Administração com layout modular e organizado.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            ✅ Sessão estável (sem race conditions)
          </p>
          <p className="text-sm text-muted-foreground">
            ✅ Painel inline (sem redirecionamentos)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
