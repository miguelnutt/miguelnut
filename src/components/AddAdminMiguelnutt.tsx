import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  nome: string;
  twitch_username: string;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

const AddAdminMiguelnutt = () => {
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [searchCompleted, setSearchCompleted] = useState(false);

  const searchUser = async () => {
    setLoading(true);
    try {
      console.log('🔍 Buscando usuário Miguelnutt...');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, twitch_username, created_at')
        .or('twitch_username.ilike.%Miguelnutt%,nome.ilike.%Miguelnutt%,display_name_canonical.ilike.%Miguelnutt%')
        .limit(1);

      if (error) {
        console.error('❌ Erro ao buscar usuário:', error);
        toast.error('Erro ao buscar usuário: ' + error.message);
        return;
      }

      if (data && data.length > 0) {
        setUserProfile(data[0]);
        console.log('✅ Usuário encontrado:', data[0]);
        toast.success('Usuário encontrado!');
        
        // Buscar roles existentes
        await checkUserRoles(data[0].id);
      } else {
        console.log('❌ Usuário não encontrado');
        toast.error('Usuário "Miguelnutt" não encontrado na base de dados');
        setUserProfile(null);
      }
      
      setSearchCompleted(true);
    } catch (error) {
      console.error('❌ Erro inesperado:', error);
      toast.error('Erro inesperado ao buscar usuário');
    } finally {
      setLoading(false);
    }
  };

  const checkUserRoles = async (userId: string) => {
    try {
      console.log('🔍 Verificando roles do usuário...');
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Erro ao buscar roles:', error);
        toast.error('Erro ao verificar roles: ' + error.message);
        return;
      }

      setUserRoles(data || []);
      console.log('📋 Roles encontradas:', data);
    } catch (error) {
      console.error('❌ Erro inesperado ao verificar roles:', error);
    }
  };

  const addAdminRole = async () => {
    if (!userProfile) {
      toast.error('Nenhum usuário selecionado');
      return;
    }

    setLoading(true);
    try {
      console.log('➕ Adicionando role de admin...');
      
      const { data, error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userProfile.id,
          role: 'admin'
        })
        .select();

      if (error) {
        console.error('❌ Erro ao adicionar role:', error);
        toast.error('Erro ao adicionar role de admin: ' + error.message);
        return;
      }

      console.log('✅ Role de admin adicionada:', data);
      toast.success('Role de admin adicionada com sucesso!');
      
      // Atualizar lista de roles
      await checkUserRoles(userProfile.id);
    } catch (error) {
      console.error('❌ Erro inesperado:', error);
      toast.error('Erro inesperado ao adicionar role');
    } finally {
      setLoading(false);
    }
  };

  const hasAdminRole = userRoles.some(role => role.role === 'admin');

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Adicionar Administrador: Miguelnutt</CardTitle>
        <CardDescription>
          Ferramenta para adicionar o usuário "Miguelnutt" como administrador
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={searchUser} 
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Buscando...' : 'Buscar Usuário'}
          </Button>
        </div>

        {searchCompleted && (
          <div className="space-y-4">
            {userProfile ? (
              <div className="p-4 border rounded-lg bg-green-50">
                <h3 className="font-semibold text-green-800">Usuário Encontrado:</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <p><strong>ID:</strong> {userProfile.id}</p>
                  <p><strong>Nome:</strong> {userProfile.nome}</p>
                  <p><strong>Twitch Username:</strong> {userProfile.twitch_username}</p>
                  <p><strong>Criado em:</strong> {new Date(userProfile.created_at).toLocaleString()}</p>
                </div>

                <div className="mt-4">
                  <h4 className="font-semibold">Roles Atuais:</h4>
                  {userRoles.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {userRoles.map(role => (
                        <li key={role.id} className="text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${
                            role.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {role.role}
                          </span>
                          <span className="ml-2 text-gray-500">
                            (desde {new Date(role.created_at).toLocaleDateString()})
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">Nenhuma role encontrada</p>
                  )}
                </div>

                <div className="mt-4">
                  {hasAdminRole ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-yellow-800">✅ Usuário já possui role de administrador</p>
                    </div>
                  ) : (
                    <Button 
                      onClick={addAdminRole} 
                      disabled={loading}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {loading ? 'Adicionando...' : 'Adicionar Role de Admin'}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 border rounded-lg bg-red-50">
                <p className="text-red-800">❌ Usuário "Miguelnutt" não encontrado na base de dados</p>
                <p className="text-sm text-red-600 mt-1">
                  Verifique se o usuário já fez login no sistema pelo menos uma vez.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AddAdminMiguelnutt;