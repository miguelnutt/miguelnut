-- Adicionar coluna para bloquear tema globalmente (light, dark ou null para sem bloqueio)
ALTER TABLE site_settings 
ADD COLUMN theme_lock text CHECK (theme_lock IN ('light', 'dark'));

COMMENT ON COLUMN site_settings.theme_lock IS 'Bloqueia o tema globalmente: light, dark ou null para permitir troca livre';