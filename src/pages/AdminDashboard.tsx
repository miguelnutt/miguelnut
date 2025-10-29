import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Coins, BarChart, Settings, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase-helper";
import { Session } from "@supabase/supabase-js";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const { isAdmin } = useAdmin(session?.user ?? null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirecionar se não for admin
  React.useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-6 w-6 text-purple-600" />
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 mb-8">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            <span>Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="economy" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            <span>Economia</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Logs</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Configurações</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Status do Sistema</CardTitle>
                <CardDescription>Visão geral do status atual</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span>StreamElements:</span>
                  <span className="text-green-500 font-medium">Conectado</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Twitch API:</span>
                  <span className="text-green-500 font-medium">Conectado</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Banco de Dados:</span>
                  <span className="text-green-500 font-medium">Online</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estatísticas</CardTitle>
                <CardDescription>Números importantes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span>Usuários Ativos:</span>
                  <span className="font-medium">--</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Rubini Coins em Circulação:</span>
                  <span className="font-medium">--</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Recompensas Diárias Hoje:</span>
                  <span className="font-medium">--</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
                <CardDescription>Operações comuns</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Gerenciar Usuários
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Coins className="mr-2 h-4 w-4" />
                  Gerenciar Rubini Coins
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Logs do Sistema
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Usuários</CardTitle>
              <CardDescription>Gerencie os usuários do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                O módulo de gestão de usuários será implementado em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="economy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Economia</CardTitle>
              <CardDescription>Gerencie a economia do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                O módulo de economia será implementado em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs do Sistema</CardTitle>
              <CardDescription>Visualize os logs do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                O módulo de logs será implementado em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
              <CardDescription>Ajuste as configurações do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                O módulo de configurações será implementado em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;