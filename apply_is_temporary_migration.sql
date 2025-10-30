-- Script para aplicar manualmente a migração da coluna is_temporary
-- Execute este script no seu banco de dados Supabase

-- Verificar se a coluna já existe antes de tentar adicioná-la
DO $$
BEGIN
    -- Verificar se a coluna is_temporary existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'is_temporary'
        AND table_schema = 'public'
    ) THEN
        -- Adicionar a coluna is_temporary
        ALTER TABLE public.profiles 
        ADD COLUMN is_temporary BOOLEAN NOT NULL DEFAULT false;
        
        RAISE NOTICE 'Coluna is_temporary adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna is_temporary já existe';
    END IF;

    -- Verificar se a coluna created_via existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'created_via'
        AND table_schema = 'public'
    ) THEN
        -- Adicionar a coluna created_via
        ALTER TABLE public.profiles 
        ADD COLUMN created_via TEXT;
        
        RAISE NOTICE 'Coluna created_via adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna created_via já existe';
    END IF;

    -- Verificar se o índice existe
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'profiles' 
        AND indexname = 'idx_profiles_is_temporary'
        AND schemaname = 'public'
    ) THEN
        -- Criar índice para melhor performance
        CREATE INDEX idx_profiles_is_temporary ON public.profiles(is_temporary) WHERE is_temporary = true;
        
        RAISE NOTICE 'Índice idx_profiles_is_temporary criado com sucesso';
    ELSE
        RAISE NOTICE 'Índice idx_profiles_is_temporary já existe';
    END IF;

END $$;

-- Adicionar comentários para documentar o propósito
COMMENT ON COLUMN public.profiles.is_temporary IS 'Indicates if this profile was created temporarily for prize delivery before user login';
COMMENT ON COLUMN public.profiles.created_via IS 'Indicates how this profile was created (e.g., prize_delivery, normal_login)';

-- Verificar o resultado
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
AND column_name IN ('is_temporary', 'created_via')
ORDER BY column_name;