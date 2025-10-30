const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qkwctrccuqkjygqurqxt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrd2N0cmNjdXFranlncXVycXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NjIxMjIsImV4cCI6MjA3NjEzODEyMn0.ZV3xFFv5JGqntrvKp0xq3kSMhHbfYA3daRZNy--blUE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateUnknownUsers() {
  console.log('🔍 Investigando problemas de usuários desconhecidos...\n');

  try {
    // 1. Verificar usuários no ranking de tickets que não têm perfil correspondente
    console.log('1. Verificando tickets sem perfil correspondente:');
    const { data: ticketsWithoutProfile, error: error1 } = await supabase
      .from('tickets')
      .select(`
        user_id,
        quantidade
      `)
      .is('profiles.id', null);

    if (error1) {
      console.error('Erro ao buscar tickets sem perfil:', error1);
    } else {
      console.log(`   Encontrados ${ticketsWithoutProfile?.length || 0} registros de tickets sem perfil`);
      if (ticketsWithoutProfile && ticketsWithoutProfile.length > 0) {
        console.log('   Primeiros 5 exemplos:', ticketsWithoutProfile.slice(0, 5));
      }
    }

    // 2. Verificar perfis sem twitch_username que têm tickets
    console.log('\n2. Verificando perfis com tickets mas sem twitch_username:');
    const { data: profilesWithoutTwitch, error: error2 } = await supabase
      .from('profiles')
      .select(`
        id,
        nome,
        twitch_username,
        tickets(quantidade)
      `)
      .or('twitch_username.is.null,twitch_username.eq.')
      .not('tickets', 'is', null);

    if (error2) {
      console.error('Erro ao buscar perfis sem twitch_username:', error2);
    } else {
      console.log(`   Encontrados ${profilesWithoutTwitch?.length || 0} perfis com tickets mas sem twitch_username`);
      if (profilesWithoutTwitch && profilesWithoutTwitch.length > 0) {
        console.log('   Primeiros 5 exemplos:', profilesWithoutTwitch.slice(0, 5));
      }
    }

    // 3. Verificar spins sem perfil correspondente
    console.log('\n3. Verificando spins sem perfil correspondente:');
    const { data: spinsWithoutProfile, error: error3 } = await supabase
      .from('spins')
      .select(`
        user_id,
        nome_usuario
      `)
      .is('profiles.id', null);

    if (error3) {
      console.error('Erro ao buscar spins sem perfil:', error3);
    } else {
      console.log(`   Encontrados ${spinsWithoutProfile?.length || 0} registros de spins sem perfil`);
      if (spinsWithoutProfile && spinsWithoutProfile.length > 0) {
        console.log('   Primeiros 5 exemplos:', spinsWithoutProfile.slice(0, 5));
      }
    }

    // 4. Verificar estrutura das tabelas
    console.log('\n4. Verificando estrutura das tabelas:');
    
    // Buscar alguns exemplos de cada tabela para entender a estrutura
    const { data: sampleProfiles } = await supabase
      .from('profiles')
      .select('*')
      .limit(3);
    
    const { data: sampleTickets } = await supabase
      .from('tickets')
      .select('*')
      .limit(3);
    
    const { data: sampleSpins } = await supabase
      .from('spins')
      .select('*')
      .limit(3);

    console.log('   Exemplo de profiles:', sampleProfiles?.[0] || 'Nenhum encontrado');
    console.log('   Exemplo de tickets:', sampleTickets?.[0] || 'Nenhum encontrado');
    console.log('   Exemplo de spins:', sampleSpins?.[0] || 'Nenhum encontrado');

    // 5. Verificar ranking atual de tickets
    console.log('\n5. Verificando ranking atual de tickets:');
    const { data: ticketRanking, error: error5 } = await supabase
      .from('tickets')
      .select(`
        user_id,
        quantidade,
        profiles(id, nome, twitch_username)
      `)
      .order('quantidade', { ascending: false })
      .limit(10);

    if (error5) {
      console.error('Erro ao buscar ranking de tickets:', error5);
    } else {
      console.log('   Top 10 ranking de tickets:');
      ticketRanking?.forEach((ticket, index) => {
        const profile = ticket.profiles;
        const username = profile?.twitch_username || profile?.nome || 'DESCONHECIDO';
        console.log(`   ${index + 1}. ${username} - ${ticket.quantidade} tickets`);
      });
    }

    // 6. Verificar histórico de spins recente
    console.log('\n6. Verificando histórico recente de spins:');
    const { data: recentSpins, error: error6 } = await supabase
      .from('spins')
      .select(`
        nome_usuario,
        tipo_recompensa,
        valor,
        created_at,
        profiles(id, nome, twitch_username)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error6) {
      console.error('Erro ao buscar spins recentes:', error6);
    } else {
      console.log('   Últimos 10 spins:');
      recentSpins?.forEach((spin, index) => {
        const profile = spin.profiles;
        const usernameFromSpin = spin.nome_usuario;
        const usernameFromProfile = profile?.twitch_username || profile?.nome;
        console.log(`   ${index + 1}. Spin: "${usernameFromSpin}" | Perfil: "${usernameFromProfile}" | ${spin.tipo_recompensa}: ${spin.valor}`);
      });
    }

  } catch (error) {
    console.error('Erro geral na investigação:', error);
  }
}

// Executar a investigação
investigateUnknownUsers().then(() => {
  console.log('\n✅ Investigação concluída!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Erro na investigação:', error);
  process.exit(1);
});