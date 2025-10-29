import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const EconomyManagement = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestão de Economia</CardTitle>
        <CardDescription>
          Módulo de gestão de economia em desenvolvimento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Este módulo permitirá gerenciar a economia do sistema.
        </p>
      </CardContent>
    </Card>
  );
};

export default EconomyManagement;
