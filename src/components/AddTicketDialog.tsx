import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { z } from "zod";
import { prepareUsernameForSearch } from "@/lib/username-utils";

interface AddTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const addTicketSchema = z.object({
  twitch_username: z.string().trim().min(1, "Usuário Twitch é obrigatório").max(100, "Nome muito longo (máximo 100 caracteres)"),
  tickets: z.number().int().positive("Quantidade deve ser maior que zero").max(10000, "Quantidade máxima é 10000")
});

export function AddTicketDialog({ open, onOpenChange, onSuccess }: AddTicketDialogProps) {
  const [twitchUsername, setTwitchUsername] = useState("");
  const [tickets, setTickets] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const ticketsNum = parseInt(tickets);
    
    const validation = addTicketSchema.safeParse({ 
      twitch_username: twitchUsername,
      tickets: ticketsNum 
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setSaving(true);
    try {
      // Preparar username para busca (remove @ se presente)
      const cleanUsername = prepareUsernameForSearch(twitchUsername);
      
      // Usar a função get_or_create_profile_by_name para buscar ou criar perfil
      const { data: userId, error: profileError } = await supabase
        .rpc('get_or_create_profile_by_name', {
          p_nome: cleanUsername
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
      const { error: ledgerError } = await supabase
        .from("ticket_ledger")
        .insert({
          user_id: userId,
          variacao: ticketsNum,
          motivo: `Adicionados ${ticketsNum} tickets manualmente`,
          idempotency_key: idempotencyKey
        });
        
      if (ledgerError) throw ledgerError;

      // Buscar nome do perfil para exibir na mensagem de sucesso
      const { data: profileData } = await supabase
        .from('profiles')
        .select('twitch_username')
        .eq('id', userId)
        .single();

      toast.success(`${ticketsNum} tickets adicionados para @${profileData?.twitch_username || twitchUsername}! Total: ${newAmount}`);

      setTwitchUsername("");
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
            <Label htmlFor="twitchUsername">Usuário Twitch</Label>
            <Input
              id="twitchUsername"
              value={twitchUsername}
              onChange={(e) => setTwitchUsername(e.target.value)}
              placeholder="@nome_do_usuario"
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
            disabled={saving || !twitchUsername.trim() || !tickets}
            className="bg-gradient-primary"
          >
            {saving ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
