-- Criar tabela de configurações do chat
CREATE TABLE IF NOT EXISTS public.chat_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_ativo BOOLEAN NOT NULL DEFAULT true,
  permitir_links BOOLEAN NOT NULL DEFAULT false,
  permitir_simbolos BOOLEAN NOT NULL DEFAULT true,
  max_caracteres INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de usuários banidos do chat
CREATE TABLE IF NOT EXISTS public.chat_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  banned_by UUID REFERENCES public.profiles(id),
  motivo TEXT,
  ban_permanente BOOLEAN NOT NULL DEFAULT false,
  ban_expira_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.chat_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_bans ENABLE ROW LEVEL SECURITY;

-- Políticas para chat_config
CREATE POLICY "Todos podem ver configurações do chat"
  ON public.chat_config FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar configurações do chat"
  ON public.chat_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para chat_bans
CREATE POLICY "Admins podem ver todos os banimentos"
  ON public.chat_bans FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar banimentos"
  ON public.chat_bans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Inserir configuração padrão
INSERT INTO public.chat_config (chat_ativo, permitir_links, permitir_simbolos, max_caracteres)
VALUES (true, false, true, 500)
ON CONFLICT DO NOTHING;

-- Adicionar trigger para updated_at
CREATE TRIGGER update_chat_config_updated_at
  BEFORE UPDATE ON public.chat_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna banned_until na tabela chat_messages para controle
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id);