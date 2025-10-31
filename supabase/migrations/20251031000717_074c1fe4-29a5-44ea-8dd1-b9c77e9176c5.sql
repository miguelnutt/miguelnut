-- Adicionar coluna de configuração de Halloween na tabela existente
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS halloween_mode_enabled BOOLEAN DEFAULT false;

-- Atualizar políticas para permitir leitura por todos
DROP POLICY IF EXISTS "Todos podem ver configurações do site" ON public.site_settings;
CREATE POLICY "Todos podem ver configurações do site"
  ON public.site_settings
  FOR SELECT
  USING (true);

-- Habilitar realtime se ainda não estiver
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;