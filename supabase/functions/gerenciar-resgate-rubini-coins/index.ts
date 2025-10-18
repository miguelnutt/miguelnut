import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verificar se é admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { action, resgateId, status, motivoRecusa, observacoes } = await req.json();

    if (action === 'list') {
      // Listar resgates com filtros
      let query = supabase
        .from('rubini_coins_resgates')
        .select(`
          *,
          profiles!rubini_coins_resgates_user_id_fkey(nome, twitch_username)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: resgates, error } = await query;

      if (error) {
        console.error('Erro ao buscar resgates:', error);
        throw new Error('Erro ao buscar resgates');
      }

      return new Response(
        JSON.stringify({ resgates }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      if (!resgateId || !status) {
        return new Response(
          JSON.stringify({ error: 'Dados incompletos' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Buscar resgate atual
      const { data: resgateAtual, error: fetchError } = await supabase
        .from('rubini_coins_resgates')
        .select('*')
        .eq('id', resgateId)
        .single();

      if (fetchError || !resgateAtual) {
        return new Response(
          JSON.stringify({ error: 'Resgate não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Se for RECUSADO, devolver o valor ao usuário
      if (status === 'RECUSADO') {
        if (!motivoRecusa || motivoRecusa.trim() === '') {
          return new Response(
            JSON.stringify({ error: 'Motivo da recusa é obrigatório' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Devolver saldo
        const { data: balance } = await supabase
          .from('rubini_coins_balance')
          .select('saldo')
          .eq('user_id', resgateAtual.user_id)
          .single();

        const novoSaldo = (balance?.saldo || 0) + resgateAtual.quantidade;

        await supabase
          .from('rubini_coins_balance')
          .upsert({
            user_id: resgateAtual.user_id,
            saldo: novoSaldo
          });

        // Registrar estorno no histórico
        await supabase.from('rubini_coins_history').insert({
          user_id: resgateAtual.user_id,
          variacao: resgateAtual.quantidade,
          motivo: `Estorno de resgate recusado - ${motivoRecusa}`
        });

        console.log(`Resgate ${resgateId} recusado e valor devolvido`);
      }

      // Atualizar resgate
      const updateData: any = {
        status,
        alterado_por: user.id,
        updated_at: new Date().toISOString()
      };

      if (status === 'RECUSADO') {
        updateData.motivo_recusa = motivoRecusa;
      }

      if (observacoes) {
        updateData.observacoes = observacoes;
      }

      const { error: updateError } = await supabase
        .from('rubini_coins_resgates')
        .update(updateData)
        .eq('id', resgateId);

      if (updateError) {
        console.error('Erro ao atualizar resgate:', updateError);
        throw new Error('Erro ao atualizar resgate');
      }

      console.log(`Resgate ${resgateId} atualizado para ${status} por ${user.id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});