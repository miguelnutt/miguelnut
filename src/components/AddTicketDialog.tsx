import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { z } from "zod";

interface AddTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const addTicketSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo (máximo 100 caracteres)"),
  tickets: z.number().int().positive("Quantidade deve ser maior que zero").max(10000, "Quantidade máxima é 10000")
});

export function AddTicketDialog({ open, onOpenChange, onSuccess }: AddTicketDialogProps) {
  const [nome, setNome] = useState("");
  const [tickets, setTickets] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const ticketsNum = parseInt(tickets);
    
    const validation = addTicketSchema.safeParse({ 
      nome,
      tickets: ticketsNum 
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setSaving(true);
    try {
      // Usar a função get_or_merge_profile_v2 para buscar ou criar perfil
      const { data: userId, error: profileError } = await supabase
        .rpc('get_or_merge_profile_v2', {
          p_twitch_user_id: null,
          p_display_name: nome.trim(),
          p_login: nome.trim().toLowerCase()
        });

      if (profileError || !userId) {
        console.error("Erro ao obter/criar perfil:", profileError);
        toast.error("Erro ao processar usuário");
        setSaving(false);
        return;
      }

      console.log("Perfil obtido/criado com sucesso. User ID:", userId);
      
      // Buscar tickets atuais
      const { data: currentTickets } = await supabase
        .from("tickets")
        .select("tickets_atual")
        .eq("user_id", userId)
        .maybeSingle();

      const currentAmount = currentTickets?.tickets_atual || 0;
      const newAmount = currentAmount + ticketsNum;

      // Atualizar tickets
      const { error: updateError } = await supabase
        .from("tickets")
        .upsert({
          user_id: userId,
          tickets_atual: newAmount
        });

      if (updateError) throw updateError;

      // Salvar no ledger com idempotency_key para evitar duplicatas
      const idempotencyKey = `add_tickets_${userId}_${Date.now()}`;
      await supabase
        .from("ticket_ledger")
        .insert({
          user_id: userId,
          variacao: ticketsNum,
          motivo: `Adicionados ${ticketsNum} tickets manualmente`,
          idempotency_key: idempotencyKey
        });

      // Buscar nome do perfil para exibir na mensagem de sucesso
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nome, twitch_username')
        .eq('id', userId)
        .single();

      toast.success(`${ticketsNum} tickets adicionados para ${profileData?.nome || profileData?.twitch_username || nome}! Total: ${newAmount}`);

        // Salvar no ledger
        await supabase
          .from("ticket_ledger")
          .insert({
            user_id: userId,
            variacao: ticketsNum,
            motivo: `Usuário criado com ${ticketsNum} tickets`
          });

        toast.success(`Novo usuário ${nome} criado com ${ticketsNum} tickets!`);
      }

      setNome("");
      setTickets("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error adding tickets:", error);
      toast.error("Erro ao adicionar tickets: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Tickets</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Usuário (Twitch)</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite o nome do usuário"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Se o usuário já existir, os tickets serão somados. Caso contrário, um novo perfil será criado automaticamente.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tickets">Quantidade de Tickets</Label>
            <Input
              id="tickets"
              type="number"
              min="1"
              max="10000"
              value={tickets}
              onChange={(e) => setTickets(e.target.value)}
              placeholder="Digite a quantidade"
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAdd}
            disabled={saving || !nome.trim() || !tickets}
            className="bg-gradient-primary"
          >
            {saving ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
