import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Coins } from 'lucide-react';
import { supabase } from '@/lib/supabase-helper';
import { AdminRubiniCoinsResgates } from './AdminRubiniCoinsResgates';

export function AdminRubiniCoinsResgatesButton() {
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadPendingCount();

    // Atualizar a cada 30 segundos
    const interval = setInterval(loadPendingCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadPendingCount = async () => {
    try {
      const { count, error } = await supabase
        .from('rubini_coins_resgates')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDENTE');

      if (!error && count !== null) {
        setPendingCount(count);
      }
    } catch (error) {
      console.error('Erro ao buscar resgates pendentes:', error);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="rounded-full relative"
        title="Resgates de Rubini Coins"
      >
        <Coins className="h-5 w-5" />
        {pendingCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {pendingCount}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          // Recarregar contador quando fechar o dialog
          loadPendingCount();
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Resgates de Rubini Coins
            </DialogTitle>
          </DialogHeader>
          <AdminRubiniCoinsResgates />
        </DialogContent>
      </Dialog>
    </>
  );
}
