import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

export function LogsSection() {
  const [dateFilter, setDateFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const handleExportCSV = () => {
    // Implementar exportação de logs
    console.log("Exportando logs...", { dateFilter, userFilter, typeFilter });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Logs</CardTitle>
          <CardDescription>Filtre e exporte logs de auditoria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-filter">Data (Brasília)</Label>
              <Input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-filter">Usuário</Label>
              <Input
                id="user-filter"
                placeholder="Nome ou ID..."
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type-filter">Tipo de Ação</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="resgate">Resgate</SelectItem>
                  <SelectItem value="se">StreamElements</SelectItem>
                  <SelectItem value="jogo">Jogo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs de Auditoria</CardTitle>
          <CardDescription>Visualização detalhada em desenvolvimento</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A tabela de logs será exibida aqui com paginação e detalhes de cada ação
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
