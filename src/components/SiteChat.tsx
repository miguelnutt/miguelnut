import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase-helper";
import { useTwitchAuth } from "@/hooks/useTwitchAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { Send, MessageCircle, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatMessage {
  id: string;
  user_id: string | null;
  user_name: string;
  user_avatar: string | null;
  message: string;
  created_at: string;
  deleted_at: string | null;
}

interface ChatConfig {
  chat_ativo: boolean;
  permitir_links: boolean;
  permitir_simbolos: boolean;
  max_caracteres: number;
}

export function SiteChat() {
  const { user: twitchUser } = useTwitchAuth();
  const [user, setUser] = useState<any>(null);
  const { isAdmin } = useAdmin(user);
  const { isAdminMode } = useAdminMode();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [userToBan, setUserToBan] = useState<{ id: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    loadMessages();
    loadConfig();

    const channel = supabase
      .channel('chat_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          setMessages(prev => prev.map(msg => 
            msg.id === payload.new.id ? payload.new as ChatMessage : msg
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setConfig(data);
    } catch (error: any) {
      console.error('Erro ao carregar configurações do chat:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const validateMessage = (message: string): boolean => {
    if (!config) return true;

    if (!config.permitir_links && (message.includes('http://') || message.includes('https://'))) {
      toast.error("Links não são permitidos no chat");
      return false;
    }

    if (!config.permitir_simbolos && /[^\w\s\u00C0-\u017F]/.test(message)) {
      toast.error("Símbolos especiais não são permitidos");
      return false;
    }

    if (message.length > config.max_caracteres) {
      toast.error(`Mensagem muito longa (máximo: ${config.max_caracteres} caracteres)`);
      return false;
    }

    return true;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    if (!config?.chat_ativo) {
      toast.error("O chat está desativado no momento");
      return;
    }

    if (!validateMessage(newMessage.trim())) {
      return;
    }

    setSending(true);
    try {
      const userName = twitchUser ? twitchUser.display_name : "Anônimo";
      const userAvatar = twitchUser ? twitchUser.profile_image_url : null;
      const userId = twitchUser ? twitchUser.twitch_user_id : null;

      const { data: isBanned } = await supabase
        .from('chat_bans')
        .select('*')
        .eq('user_name', userName)
        .or(`ban_permanente.eq.true,ban_expira_em.gt.${new Date().toISOString()}`)
        .maybeSingle();

      if (isBanned) {
        toast.error("Você está banido do chat");
        return;
      }

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: userId,
          user_name: userName,
          user_avatar: userAvatar,
          message: newMessage.trim(),
        });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id })
        .eq('id', messageToDelete);

      if (error) throw error;
      toast.success("Mensagem excluída");
      setMessages(prev => prev.filter(m => m.id !== messageToDelete));
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast.error("Erro ao excluir mensagem");
    } finally {
      setMessageToDelete(null);
    }
  };

  const handleBanUser = async (permanent: boolean) => {
    if (!userToBan) return;

    try {
      const { error } = await supabase
        .from('chat_bans')
        .insert({
          user_id: userToBan.id || null,
          user_name: userToBan.name,
          banned_by: user?.id,
          ban_permanente: permanent,
          ban_expira_em: permanent ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

      if (error) throw error;
      toast.success(`${userToBan.name} foi banido ${permanent ? 'permanentemente' : 'por 24h'}`);
    } catch (error: any) {
      console.error('Erro ao banir:', error);
      toast.error("Erro ao banir usuário");
    } finally {
      setUserToBan(null);
    }
  };

  if (!config) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <CardContent>
          <p className="text-muted-foreground">Carregando chat...</p>
        </CardContent>
      </Card>
    );
  }

  if (!config.chat_ativo) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <CardContent>
          <p className="text-muted-foreground">O chat está desativado no momento</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="h-[500px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            Chat da Comunidade
            {isAdmin && isAdminMode && (
              <Shield className="h-4 w-4 text-primary ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-2 group">
                  {msg.user_avatar ? (
                    <img
                      src={msg.user_avatar}
                      alt={msg.user_name}
                      className="h-8 w-8 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold">
                        {msg.user_name[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm">{msg.user_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {isAdmin && isAdminMode && (
                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => setMessageToDelete(msg.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          {msg.user_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => setUserToBan({ id: msg.user_id!, name: msg.user_name })}
                            >
                              <Shield className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-sm break-words">{msg.message}</p>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={twitchUser ? "Digite sua mensagem..." : "Faça login para enviar mensagens"}
              maxLength={config.max_caracteres}
              disabled={sending || !config.chat_ativo}
            />
            <Button type="submit" disabled={sending || !newMessage.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={!!messageToDelete} onOpenChange={() => setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A mensagem será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToBan} onOpenChange={() => setUserToBan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Banir usuário {userToBan?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha o tipo de banimento:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleBanUser(false)}>
              Banir 24h
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleBanUser(true)} className="bg-destructive">
              Banir Permanente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
