-- Adicionar policy de DELETE para admins na tabela tibiatermo_user_games
CREATE POLICY "Admins podem deletar jogos"
ON tibiatermo_user_games
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));