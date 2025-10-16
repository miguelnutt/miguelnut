-- Adicionar foreign key entre tickets e profiles para permitir JOIN automático
-- Isso garante integridade referencial e permite que o sorteio funcione corretamente
ALTER TABLE tickets 
ADD CONSTRAINT tickets_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;