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

  useEffect(() => {
    checkUser();
  }, []);

  // Redirecionar para home se não for admin, pois o console real é via Dialog no Navbar
  useEffect(() => {
    if (!adminLoading && !loading) {
      if (!isAdmin) {
        navigate("/");
      }
    }
  }, [adminLoading, loading, isAdmin, navigate]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (!user) {
        navigate("/login");
      }
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
        <p className="ml-2 text-muted-foreground">Verificando permissões...</p>
      </div>
    );
  }

  // Nota: Esta página é mantida por compatibilidade, mas o console real 
  // abre via Dialog no Navbar (botão Admin Console)
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Console de Administração</CardTitle>
            <CardDescription>
              Use o botão "Admin Console" no topo da página para abrir o console completo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              O Console de Administração completo abre em uma janela modal através do botão 
              <strong> Admin Console</strong> localizado no topo de qualquer página.
            </p>
            <Button onClick={() => navigate("/")}>
              Voltar para Home
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
