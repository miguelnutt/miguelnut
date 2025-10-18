-- Adicionar colunas de cor para os botões da barra promocional
ALTER TABLE public.promotional_bar_config 
ADD COLUMN IF NOT EXISTS button1_color text NOT NULL DEFAULT '#8B5CF6',
ADD COLUMN IF NOT EXISTS button2_color text NOT NULL DEFAULT '#3B82F6';