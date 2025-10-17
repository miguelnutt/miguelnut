import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase-helper";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { z } from "zod";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const addUserSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo (máximo 100 caracteres)"),
  ticketsIniciais: z.number().int("Tickets deve ser um número inteiro").min(0, "Tickets não pode ser negativo").max(100000, "Valor muito alto"),
  motivo: z.string().trim().max(500, "Motivo muito longo (máximo 500 caracteres)").optional()
});

export function AddUserDialog({ open, onOpenChange, onSuccess }: AddUserDialogProps) {
  const [nome, setNome] = useState("");
  const [ticketsIniciais, setTicketsIniciais] = useState("0");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const ticketsValue = parseInt(ticketsIniciais) || 0;
    
    // Validate input with zod
    const validation = addUserSchema.safeParse({ 
      nome, 
      ticketsIniciais: ticketsValue,
      motivo: motivo || undefined
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      // Verificar se já existe um usuário com esse nome OU twitch_username (case-insensitive)
      console.log("Buscando perfil para:", nome.trim());
      const { data: existingProfiles } = await supabase
        .from("profiles")
        .select("id, nome, twitch_username, nome_personagem")
        .or(`nome.ilike.${nome.trim()},twitch_username.ilike.${nome.trim()}`)
        .limit(1);

      console.log("Perfis encontrados:", existingProfiles);
      const existingProfile = existingProfiles && existingProfiles.length > 0 ? existingProfiles[0] : null;

      let userId: string;

      if (existingProfile) {
        // Usuário já existe, verificar se tem tickets
        const { data: existingTickets } = await supabase
          .from("tickets")
          .select("tickets_atual")
          .eq("user_id", existingProfile.id)
          .maybeSingle();

        if (existingTickets) {
          toast.error("Este usuário já possui tickets cadastrados. Use a página de gerenciamento para editar.");
          setLoading(false);
          return;
        }

        // Usuário existe mas não tem tickets, usar o ID existente
        userId = existingProfile.id;
        toast.info(`Adicionando tickets ao usuário existente: ${nome}`);
      } else {
        // Criar novo perfil
        userId = crypto.randomUUID();
        
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            nome: nome.trim()
          });

        if (profileError) throw profileError;
      }

      // Criar entrada de tickets
      const { error: ticketsError } = await supabase
        .from("tickets")
        .insert({
          user_id: userId,
          tickets_atual: ticketsValue
        });

      if (ticketsError) throw ticketsError;

      // Se tickets iniciais > 0, registrar no ledger
      if (ticketsValue > 0) {
        const { error: ledgerError } = await supabase
          .from("ticket_ledger")
          .insert({
            user_id: userId,
            variacao: ticketsValue,
            motivo: motivo.trim() || `Tickets adicionados: ${ticketsValue}`
          });

        if (ledgerError) throw ledgerError;
      }

      toast.success(`Usuário ${nome} adicionado com sucesso!`);
      
      // Reset form
      setNome("");
      setTicketsIniciais("0");
      setMotivo("");
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error("Erro ao criar usuário: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adicionar Novo Usuário
          </DialogTitle>
          <DialogDescription>
            Crie um novo usuário e defina sua quantidade inicial de tickets
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Usuário *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João Silva"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tickets">Tickets Iniciais</Label>
            <Input
              id="tickets"
              type="number"
              min="0"
              value={ticketsIniciais}
              onChange={(e) => setTicketsIniciais(e.target.value)}
              placeholder="0"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Bônus de boas-vindas"
              disabled={loading}
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Usuário"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
