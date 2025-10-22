-- ============================================
-- ETAPA 1: DESATIVAR PERFIS DUPLICADOS
-- ============================================

-- Desativar todos os perfis SEM twitch_user_id que têm equivalente COM twitch_user_id
UPDATE profiles p_old
SET is_active = false,
    merged_into = p_new.id
FROM profiles p_new
WHERE p_old.twitch_username = p_new.twitch_username
  AND p_old.twitch_user_id IS NULL
  AND p_new.twitch_user_id IS NOT NULL
  AND p_old.is_active = true
  AND p_new.is_active = true;