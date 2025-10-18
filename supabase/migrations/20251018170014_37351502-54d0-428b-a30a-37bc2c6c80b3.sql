-- Criar tabela de saldo de Rubini Coins
CREATE TABLE IF NOT EXISTS public.rubini_coins_balance (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  saldo INTEGER NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de histórico de Rubini Coins
CREATE TABLE IF NOT EXISTS public.rubini_coins_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  variacao INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar enum para status de resgate
CREATE TYPE public.resgate_status AS ENUM ('PENDENTE', 'PROCESSANDO', 'ENTREGUE', 'RECUSADO');

-- Criar tabela de resgates de Rubini Coins
CREATE TABLE IF NOT EXISTS public.rubini_coins_resgates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0 AND quantidade % 25 = 0),
  personagem TEXT NOT NULL,
  status resgate_status NOT NULL DEFAULT 'PENDENTE',
  motivo_recusa TEXT,
  observacoes TEXT,
  alterado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de créditos provisórios
CREATE TABLE IF NOT EXISTS public.creditos_provisorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twitch_username TEXT NOT NULL,
  tipo_credito TEXT NOT NULL CHECK (tipo_credito IN ('rubini_coins', 'tickets', 'pontos_loja')),
  valor INTEGER NOT NULL CHECK (valor > 0),
  motivo TEXT NOT NULL,
  aplicado BOOLEAN DEFAULT FALSE,
  aplicado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.rubini_coins_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubini_coins_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubini_coins_resgates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creditos_provisorios ENABLE ROW LEVEL SECURITY;

-- RLS Policies para rubini_coins_balance
CREATE POLICY "Usuários podem ver próprio saldo de Rubini Coins"
  ON public.rubini_coins_balance FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins podem ver todos os saldos de Rubini Coins"
  ON public.rubini_coins_balance FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode gerenciar saldos de Rubini Coins"
  ON public.rubini_coins_balance FOR ALL
  USING (true);

-- RLS Policies para rubini_coins_history
CREATE POLICY "Usuários podem ver próprio histórico de Rubini Coins"
  ON public.rubini_coins_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins podem ver todo histórico de Rubini Coins"
  ON public.rubini_coins_history FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir histórico de Rubini Coins"
  ON public.rubini_coins_history FOR INSERT
  WITH CHECK (true);

-- RLS Policies para rubini_coins_resgates
CREATE POLICY "Usuários podem ver próprios resgates"
  ON public.rubini_coins_resgates FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins podem ver todos os resgates"
  ON public.rubini_coins_resgates FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem criar resgates"
  ON public.rubini_coins_resgates FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins podem atualizar resgates"
  ON public.rubini_coins_resgates FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para creditos_provisorios
CREATE POLICY "Admins podem ver créditos provisórios"
  ON public.creditos_provisorios FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode gerenciar créditos provisórios"
  ON public.creditos_provisorios FOR ALL
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_rubini_coins_balance_updated_at
  BEFORE UPDATE ON public.rubini_coins_balance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rubini_coins_resgates_updated_at
  BEFORE UPDATE ON public.rubini_coins_resgates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_rubini_coins_history_user_id ON public.rubini_coins_history(user_id);
CREATE INDEX idx_rubini_coins_history_created_at ON public.rubini_coins_history(created_at DESC);
CREATE INDEX idx_rubini_coins_resgates_user_id ON public.rubini_coins_resgates(user_id);
CREATE INDEX idx_rubini_coins_resgates_status ON public.rubini_coins_resgates(status);
CREATE INDEX idx_rubini_coins_resgates_created_at ON public.rubini_coins_resgates(created_at DESC);
CREATE INDEX idx_creditos_provisorios_twitch_username ON public.creditos_provisorios(twitch_username);
CREATE INDEX idx_creditos_provisorios_aplicado ON public.creditos_provisorios(aplicado);

-- Migrar dados existentes de Rubini Coins do histórico
INSERT INTO public.rubini_coins_balance (user_id, saldo)
SELECT 
  r.vencedor_id,
  COALESCE(SUM(r.valor_premio), 0) as saldo
FROM public.raffles r
WHERE r.tipo_premio = 'Rubini Coins' 
  AND r.vencedor_id IS NOT NULL
GROUP BY r.vencedor_id
ON CONFLICT (user_id) DO UPDATE SET saldo = EXCLUDED.saldo;

-- Criar histórico a partir dos sorteios existentes
INSERT INTO public.rubini_coins_history (user_id, variacao, motivo, created_at)
SELECT 
  r.vencedor_id,
  r.valor_premio,
  'Sorteio: ' || COALESCE(r.observacoes, 'Prêmio de sorteio'),
  r.created_at
FROM public.raffles r
WHERE r.tipo_premio = 'Rubini Coins' 
  AND r.vencedor_id IS NOT NULL;

-- Migrar dados de spins com Rubini Coins
INSERT INTO public.rubini_coins_balance (user_id, saldo)
SELECT 
  s.user_id,
  COALESCE(SUM(CAST(s.valor AS INTEGER)), 0) as saldo
FROM public.spins s
WHERE s.tipo_recompensa = 'Rubini Coins'
  AND s.user_id IS NOT NULL
  AND s.valor ~ '^\d+$'
GROUP BY s.user_id
ON CONFLICT (user_id) DO UPDATE SET 
  saldo = rubini_coins_balance.saldo + EXCLUDED.saldo;

-- Criar histórico a partir dos spins existentes
INSERT INTO public.rubini_coins_history (user_id, variacao, motivo, created_at)
SELECT 
  s.user_id,
  CAST(s.valor AS INTEGER),
  'Roleta: Prêmio da roleta',
  s.created_at
FROM public.spins s
WHERE s.tipo_recompensa = 'Rubini Coins'
  AND s.user_id IS NOT NULL
  AND s.valor ~ '^\d+$';