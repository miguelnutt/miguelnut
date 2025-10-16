-- Função para verificar se é o primeiro usuário e atribuir role admin
CREATE OR REPLACE FUNCTION public.handle_first_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Contar quantos usuários já existem
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- Se é o primeiro usuário, adicionar role admin
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para executar após inserção de novo usuário
DROP TRIGGER IF EXISTS on_first_user_created ON auth.users;
CREATE TRIGGER on_first_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_first_user_signup();

-- Criar função para verificar se já existe usuário admin
CREATE OR REPLACE FUNCTION public.has_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role
  );
$$;