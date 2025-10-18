-- Remover política antiga e recriar
DROP POLICY IF EXISTS "Todos podem ver histórico do TibiaTermo" ON public.tibiatermo_history;

-- Criar nova política permitindo leitura para todos
CREATE POLICY "Todos podem ver histórico do TibiaTermo" 
ON public.tibiatermo_history 
FOR SELECT 
TO public
USING (true);