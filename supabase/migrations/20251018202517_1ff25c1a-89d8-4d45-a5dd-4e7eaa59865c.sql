-- Criar tabela para histórico de recompensas do TibiaTermo
CREATE TABLE tibiatermo_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  nome_usuario text NOT NULL,
  tipo_recompensa text NOT NULL,
  valor integer NOT NULL,
  num_tentativas integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE tibiatermo_history ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Todos podem ver histórico do TibiaTermo"
ON tibiatermo_history
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Sistema pode inserir histórico do TibiaTermo"
ON tibiatermo_history
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins podem deletar histórico do TibiaTermo"
ON tibiatermo_history
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));