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

type RankingType = "pontos" | "rubini" | "tickets";

export function WheelRanking() {
  const [pontosLojaRanking, setPontosLojaRanking] = useState<RankingData[]>([]);
  const [rubiniCoinsRanking, setRubiniCoinsRanking] = useState<RankingData[]>([]);
  const [ticketsRanking, setTicketsRanking] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"tudo" | "diario" | "semanal" | "mensal">("tudo");

  useEffect(() => {
    fetchRankings();

    const spinsChannel = supabase
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

    const tibiaTermoChannel = supabase
      .channel("tibiatermo_ranking_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tibiatermo_history"
        },
        () => {
          fetchRankings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(spinsChannel);
      supabase.removeChannel(tibiaTermoChannel);
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

      // Buscar pontos do TibiaTermo
      let tibiaTermoPontosQuery = supabase
        .from("tibiatermo_history")
        .select("nome_usuario, valor, created_at")
        .eq("tipo_recompensa", "Pontos de Loja");
      
      if (dataInicio) {
        tibiaTermoPontosQuery = tibiaTermoPontosQuery.gte("created_at", dataInicio);
      }

      const { data: tibiaTermoPontosData, error: tibiaTermoPontosError } = await tibiaTermoPontosQuery;
      
      if (tibiaTermoPontosError) {
        console.error('Erro ao buscar TibiaTermo pontos:', tibiaTermoPontosError);
      } else {
        console.log('TibiaTermo pontos data:', tibiaTermoPontosData);
      }

      // Agrupar e somar pontos por usuário (spins + tibia termo)
      const pontosMap = new Map<string, number>();
      
      pontosData?.forEach((spin) => {
        const valor = parseInt(spin.valor) || 0;
        pontosMap.set(
          spin.nome_usuario,
          (pontosMap.get(spin.nome_usuario) || 0) + valor
        );
      });

      tibiaTermoPontosData?.forEach((item) => {
        const valor = item.valor || 0;
        pontosMap.set(
          item.nome_usuario,
          (pontosMap.get(item.nome_usuario) || 0) + valor
        );
      });

      const pontosRanking = Array.from(pontosMap.entries())
        .map(([nome_usuario, total]) => ({ nome_usuario, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10); // Top 10

      setPontosLojaRanking(pontosRanking);

      // Ranking de Rubini Coins (incluindo variações antigas)
      let rubiniQuery = supabase
        .from("spins")
        .select("nome_usuario, valor, created_at, tipo_recompensa")
        .or("tipo_recompensa.eq.Rubini Coins,tipo_recompensa.eq.RC");
      
      if (dataInicio) {
        rubiniQuery = rubiniQuery.gte("created_at", dataInicio);
      }

      const { data: rubiniData, error: rubiniError } = await rubiniQuery;
      if (rubiniError) throw rubiniError;

      // Buscar Rubini Coins de sorteios
      let raffleQuery = supabase
        .from("raffles")
        .select("nome_vencedor, valor_premio, created_at")
        .eq("tipo_premio", "Rubini Coins");
      
      if (dataInicio) {
        raffleQuery = raffleQuery.gte("created_at", dataInicio);
      }

      const { data: raffleData, error: raffleError } = await raffleQuery;
      if (raffleError) throw raffleError;

      // Agrupar e somar coins por usuário
      const rubiniMap = new Map<string, number>();
      
      // Adicionar Rubini Coins das roletas
      rubiniData?.forEach((spin) => {
        const valor = parseInt(spin.valor) || 0;
        rubiniMap.set(
          spin.nome_usuario,
          (rubiniMap.get(spin.nome_usuario) || 0) + valor
        );
      });

      // Adicionar Rubini Coins dos sorteios
      raffleData?.forEach((raffle) => {
        const valor = raffle.valor_premio || 0;
        rubiniMap.set(
          raffle.nome_vencedor,
          (rubiniMap.get(raffle.nome_vencedor) || 0) + valor
        );
      });

      const rubiniRanking = Array.from(rubiniMap.entries())
        .map(([nome_usuario, total]) => ({ nome_usuario, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10); // Top 10

      setRubiniCoinsRanking(rubiniRanking);

      // Ranking de Tickets
      let ticketsQuery = supabase
        .from("spins")
        .select("nome_usuario, valor, created_at")
        .eq("tipo_recompensa", "Tickets");
      
      if (dataInicio) {
        ticketsQuery = ticketsQuery.gte("created_at", dataInicio);
      }

      const { data: ticketsData, error: ticketsError } = await ticketsQuery;
      if (ticketsError) throw ticketsError;

      // Buscar tickets do TibiaTermo
      let tibiaTermoTicketsQuery = supabase
        .from("tibiatermo_history")
        .select("nome_usuario, valor, created_at")
        .eq("tipo_recompensa", "Tickets");
      
      if (dataInicio) {
        tibiaTermoTicketsQuery = tibiaTermoTicketsQuery.gte("created_at", dataInicio);
      }

      const { data: tibiaTermoTicketsData, error: tibiaTermoTicketsError } = await tibiaTermoTicketsQuery;
      
      if (tibiaTermoTicketsError) {
        console.error('Erro ao buscar TibiaTermo tickets:', tibiaTermoTicketsError);
      } else {
        console.log('TibiaTermo tickets data:', tibiaTermoTicketsData);
      }

      // Agrupar e somar tickets por usuário (spins + tibia termo)
      const ticketsMap = new Map<string, number>();
      
      ticketsData?.forEach((spin) => {
        const valor = parseInt(spin.valor) || 0;
        ticketsMap.set(
          spin.nome_usuario,
          (ticketsMap.get(spin.nome_usuario) || 0) + valor
        );
      });

      tibiaTermoTicketsData?.forEach((item) => {
        const valor = item.valor || 0;
        ticketsMap.set(
          item.nome_usuario,
          (ticketsMap.get(item.nome_usuario) || 0) + valor
        );
      });

      const ticketsRankingData = Array.from(ticketsMap.entries())
        .map(([nome_usuario, total]) => ({ nome_usuario, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10); // Top 10

      setTicketsRanking(ticketsRankingData);
    } catch (error) {
      console.error("Error fetching rankings:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (data: RankingData[], type: RankingType) => {
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
              {type === "pontos" ? "Pontos" : type === "rubini" ? "Rubini Coins" : "Tickets"}
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
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="pontos" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Pontos de Loja
            </TabsTrigger>
            <TabsTrigger value="rubini" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Rubini Coins
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Tickets
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pontos">
            {renderTable(pontosLojaRanking, "pontos")}
          </TabsContent>
          <TabsContent value="rubini">
            {renderTable(rubiniCoinsRanking, "rubini")}
          </TabsContent>
          <TabsContent value="tickets">
            {renderTable(ticketsRanking, "tickets")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
