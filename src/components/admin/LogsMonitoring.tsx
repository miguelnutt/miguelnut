import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LogsMonitoring = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitoramento de Logs</CardTitle>
        <CardDescription>
          Módulo de logs em desenvolvimento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Este módulo permitirá visualizar e monitorar logs do sistema.
        </p>
      </CardContent>
    </Card>
  );
};

export default LogsMonitoring;
