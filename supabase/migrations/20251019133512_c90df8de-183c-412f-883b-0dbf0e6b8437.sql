-- Criar tabela para logs de sincronização com StreamElements
CREATE TABLE public.streamelements_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES public.profiles(id),
  username TEXT NOT NULL,
  points_added INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  saldo_antes INTEGER,
  saldo_depois INTEGER,
  saldo_verificado BOOLEAN NOT NULL DEFAULT false,
  tipo_operacao TEXT NOT NULL, -- 'spin', 'raffle', 'daily_reward', etc
  referencia_id UUID,
  verificado_em TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.streamelements_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policy para admins verem todos os logs
CREATE POLICY "Admins podem ver todos os logs de SE"
ON public.streamelements_sync_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy para sistema inserir logs
CREATE POLICY "Sistema pode inserir logs de SE"
ON public.streamelements_sync_logs
FOR INSERT
WITH CHECK (true);

-- Policy para sistema atualizar logs (verificação)
CREATE POLICY "Sistema pode atualizar logs de SE"
ON public.streamelements_sync_logs
FOR UPDATE
USING (true);

-- Índices para melhor performance
CREATE INDEX idx_se_logs_created_at ON public.streamelements_sync_logs(created_at DESC);
CREATE INDEX idx_se_logs_username ON public.streamelements_sync_logs(username);
CREATE INDEX idx_se_logs_success ON public.streamelements_sync_logs(success);
CREATE INDEX idx_se_logs_tipo ON public.streamelements_sync_logs(tipo_operacao);