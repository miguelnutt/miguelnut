-- Adicionar coluna visivel_para_usuarios na tabela wheels
ALTER TABLE wheels ADD COLUMN IF NOT EXISTS visivel_para_usuarios BOOLEAN DEFAULT true;

-- Criar tabela para configurações de recompensa diária
CREATE TABLE IF NOT EXISTS daily_reward_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia INTEGER NOT NULL CHECK (dia >= 1 AND dia <= 30),
  pontos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dia)
);

-- Criar tabela para rastrear logins diários dos usuários
CREATE TABLE IF NOT EXISTS user_daily_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  dia_atual INTEGER NOT NULL DEFAULT 1 CHECK (dia_atual >= 1 AND dia_atual <= 30),
  ultimo_login DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Criar tabela para histórico de recompensas resgatadas
CREATE TABLE IF NOT EXISTS daily_rewards_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  dia INTEGER NOT NULL,
  pontos INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE daily_reward_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_rewards_history ENABLE ROW LEVEL SECURITY;

-- Políticas para daily_reward_config
CREATE POLICY "Todos podem ver configurações de recompensa"
  ON daily_reward_config FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar configurações de recompensa"
  ON daily_reward_config FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Políticas para user_daily_logins
CREATE POLICY "Usuários podem ver próprios logins"
  ON user_daily_logins FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Sistema pode inserir logins"
  ON user_daily_logins FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Sistema pode atualizar logins"
  ON user_daily_logins FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins podem ver todos os logins"
  ON user_daily_logins FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Políticas para daily_rewards_history
CREATE POLICY "Usuários podem ver próprio histórico"
  ON daily_rewards_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Sistema pode inserir histórico"
  ON daily_rewards_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins podem ver todo histórico"
  ON daily_rewards_history FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Inserir configurações padrão de recompensa diária (25 pontos por dia)
INSERT INTO daily_reward_config (dia, pontos)
SELECT dia, 25 * dia
FROM generate_series(1, 30) AS dia
ON CONFLICT (dia) DO NOTHING;

-- Adicionar trigger para atualizar updated_at em daily_reward_config
CREATE TRIGGER update_daily_reward_config_updated_at
  BEFORE UPDATE ON daily_reward_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Adicionar trigger para atualizar updated_at em user_daily_logins
CREATE TRIGGER update_user_daily_logins_updated_at
  BEFORE UPDATE ON user_daily_logins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();