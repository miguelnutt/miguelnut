import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";

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
    const jwtSecret = Deno.env.get('JWT_SECRET')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pegar token JWT do header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Token não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Decodificar e validar o JWT
    let twitchUser;
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jose.jwtVerify(token, secret);
      twitchUser = payload;
      console.log('JWT decodificado:', twitchUser);
    } catch (jwtError: any) {
      console.error('Erro ao validar JWT:', jwtError);
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!twitchUser || !twitchUser.login) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado no token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pegar nome do personagem do body
    const { nome_personagem } = await req.json();

    if (!nome_personagem || !nome_personagem.trim()) {
      return new Response(
        JSON.stringify({ error: 'Nome do personagem não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Salvando personagem:', {
      twitch_username: twitchUser.login,
      nome_personagem: nome_personagem.trim()
    });

    // Buscar perfil existente (incluindo inativos para melhor debug)
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('id, nome_personagem, is_active')
      .eq('twitch_username', twitchUser.login as string)
      .maybeSingle();

    if (selectError) {
      console.error('Erro ao buscar perfil existente:', selectError);
      throw new Error(`Erro ao buscar perfil: ${selectError.message}`);
    }

    console.log('Perfil encontrado:', existingProfile);

    if (existingProfile) {
      // Verificar se o perfil está ativo
      if (!existingProfile.is_active) {
        console.log('Reativando perfil inativo:', existingProfile.id);
        // Reativar perfil e atualizar nome do personagem
        const { error: reactivateError } = await supabase
          .from('profiles')
          .update({ 
            nome_personagem: nome_personagem.trim(),
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProfile.id);

        if (reactivateError) {
          console.error('Erro ao reativar perfil:', reactivateError);
          throw new Error(`Erro ao reativar perfil: ${reactivateError.message}`);
        }

        console.log('Perfil reativado e atualizado:', existingProfile.id);
      } else {
        // Atualizar perfil existente ativo
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            nome_personagem: nome_personagem.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProfile.id);

        if (updateError) {
          console.error('Erro ao atualizar perfil:', updateError);
          throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
        }

        console.log('Perfil atualizado:', existingProfile.id);
      }
    } else {
      // Criar novo perfil com UUID gerado
      const newId = crypto.randomUUID();
      console.log('Criando novo perfil com ID:', newId);
      
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: newId,
          nome: (twitchUser.display_name as string) || (twitchUser.login as string),
          twitch_username: twitchUser.login as string,
          nome_personagem: nome_personagem.trim(),
          is_active: true
        });

      if (insertError) {
        console.error('Erro ao criar perfil:', insertError);
        throw new Error(`Erro ao criar perfil: ${insertError.message}`);
      }

      console.log('Novo perfil criado para:', twitchUser.login, 'com ID:', newId);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        nome_personagem: nome_personagem.trim()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});