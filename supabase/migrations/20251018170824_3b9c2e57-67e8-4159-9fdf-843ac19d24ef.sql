-- Criar tabela de configuração da barra promocional
CREATE TABLE IF NOT EXISTS public.promotional_bar_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  button1_text TEXT NOT NULL DEFAULT 'Crie sua conta no Rubinot',
  button1_url TEXT NOT NULL DEFAULT 'https://rubinot.site/miguelnutt',
  button2_text TEXT NOT NULL DEFAULT 'Crie seu site com IA grátis',
  button2_url TEXT NOT NULL DEFAULT 'https://lovable.dev/invite/RNZUAZW',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.promotional_bar_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Todos podem ver configurações da barra promocional"
  ON public.promotional_bar_config FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar configurações da barra"
  ON public.promotional_bar_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_promotional_bar_config_updated_at
  BEFORE UPDATE ON public.promotional_bar_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração padrão
INSERT INTO public.promotional_bar_config (button1_text, button1_url, button2_text, button2_url)
VALUES (
  'Crie sua conta no Rubinot',
  'https://rubinot.site/miguelnutt',
  'Crie seu site com IA grátis',
  'https://lovable.dev/invite/RNZUAZW'
);