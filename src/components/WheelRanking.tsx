import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase-helper";
import { Trophy, Coins } from "lucide-react";

interface RankingData {
  nome_usuario: string;
  total: number;
}

export function WheelRanking() {
  const [pontosLojaRanking, setPontosLojaRanking] = useState<RankingData[]>([]);
  const [rubiniCoinsRanking, setRubiniCoinsRanking] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"tudo" | "diario" | "semanal" | "mensal">("tudo");

  useEffect(() => {
    fetchRankings();

    const channel = supabase
      .channel("spins_ranking_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "spins"
        },
        () => {
          fetchRankings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [periodo]);

  const fetchRankings = async () => {
    try {
      // Calcular data de início baseado no período
      let dataInicio: string | null = null;
      const agora = new Date();
      
      if (periodo === "diario") {
        agora.setHours(0, 0, 0, 0);
        dataInicio = agora.toISOString();
      } else if (periodo === "semanal") {
        agora.setDate(agora.getDate() - 7);
        dataInicio = agora.toISOString();
      } else if (periodo === "mensal") {
        agora.setDate(agora.getDate() - 30);
        dataInicio = agora.toISOString();
      }

      // Ranking de Pontos de Loja
      let pontosQuery = supabase
        .from("spins")
        .select("nome_usuario, valor, created_at")
        .eq("tipo_recompensa", "Pontos de Loja");
      
      if (dataInicio) {
        pontosQuery = pontosQuery.gte("created_at", dataInicio);
      }

      const { data: pontosData, error: pontosError } = await pontosQuery;

      if (pontosError) throw pontosError;

      // Agrupar e somar pontos por usuário
      const pontosMap = new Map<string, number>();
      pontosData?.forEach((spin) => {
        const valor = parseInt(spin.valor) || 0;
        pontosMap.set(
          spin.nome_usuario,
          (pontosMap.get(spin.nome_usuario) || 0) + valor
        );
      });

      const pontosRanking = Array.from(pontosMap.entries())
        .map(([nome_usuario, total]) => ({ nome_usuario, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10); // Top 10

      setPontosLojaRanking(pontosRanking);

      // Ranking de Rubini Coins
      let rubiniQuery = supabase
        .from("spins")
        .select("nome_usuario, valor, created_at")
        .eq("tipo_recompensa", "Rubini Coins");
      
      if (dataInicio) {
        rubiniQuery = rubiniQuery.gte("created_at", dataInicio);
      }

      const { data: rubiniData, error: rubiniError } = await rubiniQuery;

      if (rubiniError) throw rubiniError;

      // Agrupar e somar coins por usuário
      const rubiniMap = new Map<string, number>();
      rubiniData?.forEach((spin) => {
        const valor = parseInt(spin.valor) || 0;
        rubiniMap.set(
          spin.nome_usuario,
          (rubiniMap.get(spin.nome_usuario) || 0) + valor
        );
      });

      const rubiniRanking = Array.from(rubiniMap.entries())
        .map(([nome_usuario, total]) => ({ nome_usuario, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10); // Top 10

      setRubiniCoinsRanking(rubiniRanking);
    } catch (error) {
      console.error("Error fetching rankings:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (data: RankingData[], type: "pontos" | "rubini") => {
    if (loading) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Carregando...
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum dado disponível ainda
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead className="text-right">
              {type === "pontos" ? "Pontos" : "Rubini Coins"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow key={item.nome_usuario}>
              <TableCell className="font-medium">
                {index + 1 === 1 && "🥇"}
                {index + 1 === 2 && "🥈"}
                {index + 1 === 3 && "🥉"}
                {index + 1 > 3 && index + 1}
              </TableCell>
              <TableCell>{item.nome_usuario}</TableCell>
              <TableCell className="text-right font-semibold">
                {item.total.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Ranking de Prêmios
          </CardTitle>
          <Select value={periodo} onValueChange={(value: any) => setPeriodo(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tudo">Tudo</SelectItem>
              <SelectItem value="diario">Diário</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pontos" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="pontos" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Pontos de Loja
            </TabsTrigger>
            <TabsTrigger value="rubini" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Rubini Coins
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pontos">
            {renderTable(pontosLojaRanking, "pontos")}
          </TabsContent>
          <TabsContent value="rubini">
            {renderTable(rubiniCoinsRanking, "rubini")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
