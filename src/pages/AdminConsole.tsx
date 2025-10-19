import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-helper";
import { useAdmin } from "@/hooks/useAdmin";
import { Loader2, LayoutDashboard, Users, Wallet, Calendar, Gamepad2, Radio, FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Console de Administração</h1>
          <p className="text-muted-foreground">Gerencie todas as configurações do sistema</p>
        </div>

        {/* Menu de navegação */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={activeSection === item.id ? "default" : "outline"}
              onClick={() => setActiveSection(item.id)}
              className="flex items-center gap-2"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
