import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  }, []);

  const fetchRankings = async () => {
    try {
      // Ranking de Pontos de Loja
      const { data: pontosData, error: pontosError } = await supabase
        .from("spins")
        .select("nome_usuario, valor")
        .eq("tipo_recompensa", "Pontos de Loja");

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
      const { data: rubiniData, error: rubiniError } = await supabase
        .from("spins")
        .select("nome_usuario, valor")
        .eq("tipo_recompensa", "Rubini Coins");

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
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Ranking de Prêmios
        </CardTitle>
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
