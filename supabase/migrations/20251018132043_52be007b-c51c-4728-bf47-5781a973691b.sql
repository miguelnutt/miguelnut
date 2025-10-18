-- Criar tabela de mensagens do chat
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Mensagens são visíveis para todos"
ON public.chat_messages
FOR SELECT
USING (true);

CREATE POLICY "Usuários autenticados podem enviar mensagens"
ON public.chat_messages
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL OR user_id IS NULL);

-- Admins podem deletar mensagens
CREATE POLICY "Admins podem deletar mensagens"
ON public.chat_messages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;