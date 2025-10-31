import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      userId, 
      amount, 
      source = 'roulette', 
      reason = 'Prêmio da roleta', 
      idempotencyKey,
      origem = 'roulette'
    } = await req.json()

    // Validações básicas
    if (!userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'userId é obrigatório' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!amount || typeof amount !== 'number') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'amount deve ser um número válido' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!idempotencyKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'idempotencyKey é obrigatório' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verificar se o usuário existe
    const { data: userExists, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (userError || !userExists) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Usuário não encontrado' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Chamar função SQL atômica
    const { data: result, error: awardError } = await supabase
      .rpc('award_tickets_atomic', {
        p_user_id: userId,
        p_amount: amount,
        p_source: source,
        p_reason: reason,
        p_idempotency_key: idempotencyKey,
        p_origem: origem
      })

    if (awardError) {
      console.error('Erro ao executar award_tickets_atomic:', awardError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro interno do servidor',
          details: awardError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verificar se a função retornou erro
    if (!result.success) {
      return new Response(
        JSON.stringify(result),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log da operação para auditoria
    console.log('Award de tickets executado:', {
      userId,
      amount,
      source,
      reason,
      idempotencyKey,
      origem,
      newBalance: result.newBalance,
      duplicate: result.duplicate
    })

    return new Response(
      JSON.stringify({
        success: true,
        newBalance: result.newBalance,
        previousBalance: result.previousBalance,
        amount: result.amount,
        duplicate: result.duplicate || false,
        message: result.duplicate ? 'Transação já processada' : 'Tickets creditados com sucesso'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erro na edge function award-tickets-atomic:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno do servidor' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})