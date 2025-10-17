-- Adicionar campo nome_personagem à tabela profiles se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'nome_personagem'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN nome_personagem text;
  END IF;
END $$;