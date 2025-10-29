import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const UserManagement = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestão de Usuários</CardTitle>
        <CardDescription>
          Módulo de gestão de usuários em desenvolvimento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Este módulo permitirá gerenciar usuários do sistema.
        </p>
      </CardContent>
    </Card>
  );
};

export default UserManagement;
