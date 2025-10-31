-- Adicionar coluna para URL da imagem do header
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS header_profile_image_url TEXT DEFAULT NULL;

-- Inserir valor padrão (imagem atual)
UPDATE public.site_settings 
SET header_profile_image_url = '/src/assets/profile-miguelnut.png'
WHERE header_profile_image_url IS NULL;