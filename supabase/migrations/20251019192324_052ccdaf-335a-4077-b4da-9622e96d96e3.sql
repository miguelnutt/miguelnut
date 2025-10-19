-- Adicionar campo para referência ao log original (para reversos)
ALTER TABLE public.streamelements_sync_logs 
ADD COLUMN IF NOT EXISTS ref_original_log_id uuid REFERENCES public.streamelements_sync_logs(id) ON DELETE SET NULL;

-- Adicionar índice para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_streamelements_sync_logs_ref_original 
ON public.streamelements_sync_logs(ref_original_log_id);

-- Adicionar campo para admin que executou o estorno (auditoria)
ALTER TABLE public.streamelements_sync_logs 
ADD COLUMN IF NOT EXISTS admin_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.streamelements_sync_logs.ref_original_log_id IS 'Referência ao log original quando este é um estorno/reverso';
COMMENT ON COLUMN public.streamelements_sync_logs.admin_user_id IS 'ID do admin que executou o estorno (apenas para reversos)';