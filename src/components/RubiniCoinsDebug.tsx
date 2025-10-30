import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-helper';

interface UserDebugInfo {
  id: string;
  nome: string | null;
  twitch_username: string | null;
  twitch_user_id: string | null;
  nome_personagem: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  rubini_coins_balance: number | null;
  rubini_coins_resgates: any[];
  canMakeRequest: boolean;
  issues: string[];
}

interface RubiniCoinsDebugInfo {
  totalProfiles: number;
  profilesWithCharacters: number;
  profilesWithRubiniCoins: number;
  activeProfiles: number;
  recentResgates: any[];
  sampleUsers: UserDebugInfo[];
  problemUsers: UserDebugInfo[];
  workingUsers: UserDebugInfo[];
}

export default function RubiniCoinsDebug() {
  const [debugInfo, setDebugInfo] = useState<RubiniCoinsDebugInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('');

  useEffect(() => {
    fetchDebugData();
  }, []);

  const analyzeUserIssues = (user: any): { canMakeRequest: boolean; issues: string[] } => {
    const issues: string[] = [];
    let canMakeRequest = true;

    // Verificar se tem nome_personagem
    if (!user.nome_personagem || user.nome_personagem.trim() === '') {
      issues.push('Sem nome_personagem cadastrado');
      canMakeRequest = false;
    }

    // Verificar se está ativo
    if (!user.is_active) {
      issues.push('Perfil não está ativo (is_active = false)');
      canMakeRequest = false;
    }

    // Verificar dados do Twitch
    if (!user.twitch_username) {
      issues.push('Sem twitch_username');
    }
    if (!user.twitch_user_id) {
      issues.push('Sem twitch_user_id');
    }

    // Verificar saldo de Rubini Coins
    if (!user.rubini_coins_balance || user.rubini_coins_balance < 25) {
      issues.push(`Saldo insuficiente: ${user.rubini_coins_balance || 0} (mínimo: 25)`);
      canMakeRequest = false;
    }

    return { canMakeRequest, issues };
  };

  const fetchDebugData = async () => {
    try {
      // Contar totais
      const { count: totalProfiles } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: profilesWithCharacters } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('nome_personagem', 'is', null)
        .neq('nome_personagem', '');

      const { count: profilesWithRubiniCoins } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('rubini_coins_balance', 1);

      const { count: activeProfiles } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Buscar resgates recentes
      const { data: recentResgates } = await supabase
        .from('rubini_coins_resgates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // Buscar amostra de usuários
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);

      // Buscar resgates para cada usuário
      const profilesWithResgates = await Promise.all(
        (allProfiles || []).map(async (profile) => {
          const { data: resgates } = await supabase
            .from('rubini_coins_resgates')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false });

          const analysis = analyzeUserIssues(profile);

          return {
            ...profile,
            rubini_coins_resgates: resgates || [],
            ...analysis
          };
        })
      );

      // Separar usuários problemáticos e funcionais
      const problemUsers = profilesWithResgates.filter(user => !user.canMakeRequest);
      const workingUsers = profilesWithResgates.filter(user => user.canMakeRequest);

      setDebugInfo({
        totalProfiles: totalProfiles || 0,
        profilesWithCharacters: profilesWithCharacters || 0,
        profilesWithRubiniCoins: profilesWithRubiniCoins || 0,
        activeProfiles: activeProfiles || 0,
        recentResgates: recentResgates || [],
        sampleUsers: profilesWithResgates,
        problemUsers: problemUsers.slice(0, 10),
        workingUsers: workingUsers.slice(0, 10)
      });
    } catch (error) {
      console.error('Erro ao buscar dados de debug:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchSpecificUser = async () => {
    if (!selectedUser.trim()) return;

    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .or(`nome.ilike.%${selectedUser}%,twitch_username.ilike.%${selectedUser}%,nome_personagem.ilike.%${selectedUser}%`)
        .maybeSingle();

      if (userProfile) {
        const { data: resgates } = await supabase
          .from('rubini_coins_resgates')
          .select('*')
          .eq('user_id', userProfile.id)
          .order('created_at', { ascending: false });

        const analysis = analyzeUserIssues(userProfile);
        const userWithAnalysis = {
          ...userProfile,
          rubini_coins_resgates: resgates || [],
          ...analysis
        };

        alert(`Usuário encontrado:\n${JSON.stringify(userWithAnalysis, null, 2)}`);
      } else {
        alert('Usuário não encontrado');
      }
    } catch (error) {
      console.error('Erro ao buscar usuário específico:', error);
      alert('Erro ao buscar usuário');
    }
  };

  if (loading) {
    return <div>Carregando dados de debug do Rubini Coins...</div>;
  }

  if (!debugInfo) {
    return <div>Erro ao carregar dados de debug</div>;
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      left: '10px', 
      background: 'white', 
      border: '1px solid #ccc', 
      padding: '20px', 
      maxWidth: '800px',
      maxHeight: '90vh',
      overflow: 'auto',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <h3>Debug Rubini Coins - Análise de Usuários</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Buscar usuário específico..." 
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button onClick={searchSpecificUser} style={{ padding: '5px 10px' }}>
          Buscar
        </button>
      </div>

      <h4>Estatísticas Gerais:</h4>
      <ul>
        <li>Total de Perfis: {debugInfo.totalProfiles}</li>
        <li>Perfis com Personagens: {debugInfo.profilesWithCharacters}</li>
        <li>Perfis com Rubini Coins: {debugInfo.profilesWithRubiniCoins}</li>
        <li>Perfis Ativos: {debugInfo.activeProfiles}</li>
        <li>Usuários Problemáticos (amostra): {debugInfo.problemUsers.length}</li>
        <li>Usuários Funcionais (amostra): {debugInfo.workingUsers.length}</li>
      </ul>

      <h4>Resgates Recentes ({debugInfo.recentResgates.length}):</h4>
      <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
        {JSON.stringify(debugInfo.recentResgates, null, 2)}
      </pre>

      <h4>Usuários Problemáticos (não conseguem fazer resgate):</h4>
      {debugInfo.problemUsers.map((user, index) => (
        <div key={index} style={{ 
          border: '1px solid red', 
          margin: '10px 0', 
          padding: '10px',
          backgroundColor: '#ffe6e6'
        }}>
          <strong>{user.nome || user.twitch_username || 'Sem nome'}</strong>
          <br />
          <strong>Problemas:</strong> {user.issues.join(', ')}
          <br />
          <strong>Dados:</strong>
          <pre style={{ fontSize: '10px', maxHeight: '100px', overflow: 'auto' }}>
            {JSON.stringify({
              id: user.id,
              nome: user.nome,
              twitch_username: user.twitch_username,
              twitch_user_id: user.twitch_user_id,
              nome_personagem: user.nome_personagem,
              is_active: user.is_active,
              rubini_coins_balance: user.rubini_coins_balance,
              resgates_count: user.rubini_coins_resgates.length
            }, null, 2)}
          </pre>
        </div>
      ))}

      <h4>Usuários Funcionais (podem fazer resgate):</h4>
      {debugInfo.workingUsers.slice(0, 5).map((user, index) => (
        <div key={index} style={{ 
          border: '1px solid green', 
          margin: '10px 0', 
          padding: '10px',
          backgroundColor: '#e6ffe6'
        }}>
          <strong>{user.nome || user.twitch_username || 'Sem nome'}</strong>
          <br />
          <strong>Status:</strong> ✅ Pode fazer resgate
          <br />
          <strong>Dados:</strong>
          <pre style={{ fontSize: '10px', maxHeight: '100px', overflow: 'auto' }}>
            {JSON.stringify({
              id: user.id,
              nome: user.nome,
              twitch_username: user.twitch_username,
              twitch_user_id: user.twitch_user_id,
              nome_personagem: user.nome_personagem,
              is_active: user.is_active,
              rubini_coins_balance: user.rubini_coins_balance,
              resgates_count: user.rubini_coins_resgates.length
            }, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}