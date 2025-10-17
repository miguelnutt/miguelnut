-- Atualizar função para capturar twitch_username ao criar perfil
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome, twitch_username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'preferred_username',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    CASE 
      -- Capturar username da Twitch se o provider for twitch
      WHEN NEW.raw_app_meta_data->>'provider' = 'twitch' 
      THEN COALESCE(
        NEW.raw_user_meta_data->>'preferred_username',
        NEW.raw_user_meta_data->>'name'
      )
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    twitch_username = COALESCE(
      EXCLUDED.twitch_username, 
      profiles.twitch_username
    );
  RETURN NEW;
END;
$function$;