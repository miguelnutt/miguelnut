import { z } from "zod";

// Schema de validação para entrada do spin
export const spinInputSchema = z.object({
  nomeUsuario: z.string()
    .trim()
    .min(1, "Nome de usuário é obrigatório")
    .max(100, "Nome muito longo (máximo 100 caracteres)")
    .regex(/^@?[a-zA-Z0-9_]+$/, "Nome de usuário deve conter apenas letras, números e underscore")
});

// Interface para resultado de validação
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  resolvedUsername?: string;
  userContext?: {
    isLoggedIn: boolean;
    twitchId?: string;
    displayName?: string;
  };
}

// Interface para configuração de validação
export interface ValidationConfig {
  requireLogin?: boolean;
  allowTemporaryProfiles?: boolean;
  strictUsernameMatch?: boolean;
}

/**
 * Valida a entrada do usuário antes de permitir o spin
 */
export async function validateSpinInput(
  inputUsername: string,
  twitchUser: { login: string; id: string; display_name: string } | null,
  config: ValidationConfig = {}
): Promise<ValidationResult> {
  const {
    requireLogin = false,
    allowTemporaryProfiles = true,
    strictUsernameMatch = false
  } = config;

  const warnings: string[] = [];
  
  // Validação básica do schema
  const schemaValidation = spinInputSchema.safeParse({ nomeUsuario: inputUsername });
  if (!schemaValidation.success) {
    return {
      isValid: false,
      error: schemaValidation.error.errors[0].message
    };
  }

  const cleanUsername = inputUsername.trim().toLowerCase().replace(/^@/, '');
  
  // Se login é obrigatório e usuário não está logado
  if (requireLogin && !twitchUser) {
    return {
      isValid: false,
      error: "Login no Twitch é obrigatório para participar da roleta"
    };
  }

  // Se usuário está logado, validar consistência
  if (twitchUser) {
    const loggedUsername = twitchUser.login.toLowerCase();
    
    // Se o usuário digitou um nome diferente do login
    if (cleanUsername && cleanUsername !== loggedUsername) {
      if (strictUsernameMatch) {
        return {
          isValid: false,
          error: `Você está logado como ${twitchUser.login}. Use este nome ou faça logout para usar outro.`
        };
      } else {
        warnings.push(
          `Você está logado como ${twitchUser.login} mas digitou ${cleanUsername}. O prêmio será creditado para ${cleanUsername}.`
        );
      }
    }

    return {
      isValid: true,
      warnings,
      resolvedUsername: cleanUsername || loggedUsername,
      userContext: {
        isLoggedIn: true,
        twitchId: twitchUser.id,
        displayName: twitchUser.display_name
      }
    };
  }

  // Usuário não logado
  if (!allowTemporaryProfiles) {
    return {
      isValid: false,
      error: "É necessário estar logado para participar da roleta"
    };
  }

  if (!cleanUsername) {
    return {
      isValid: false,
      error: "Nome de usuário é obrigatório para usuários não logados"
    };
  }

  warnings.push(
    "Você não está logado. O prêmio será creditado em um perfil temporário que pode não ser acessível posteriormente."
  );

  return {
    isValid: true,
    warnings,
    resolvedUsername: cleanUsername,
    userContext: {
      isLoggedIn: false
    }
  };
}

/**
 * Gera uma chave de idempotência única para o spin
 */
export function generateSpinIdempotencyKey(
  spinId: string,
  userId: string,
  rewardType: string
): string {
  const timestamp = Date.now();
  const type = rewardType.toLowerCase().replace(/\s+/g, '-');
  return `spin-${spinId}-${userId}-${type}-${timestamp}`;
}

/**
 * Valida se o prêmio pode ser creditado
 */
export function validatePrizeAwarding(
  prize: { tipo: string; valor: string },
  userId: string
): ValidationResult {
  if (!userId) {
    return {
      isValid: false,
      error: "ID do usuário é obrigatório para creditar prêmio"
    };
  }

  if (!prize.tipo || !prize.valor) {
    return {
      isValid: false,
      error: "Dados do prêmio são inválidos"
    };
  }

  const valor = parseInt(prize.valor);
  if (isNaN(valor) || valor <= 0) {
    return {
      isValid: false,
      error: "Valor do prêmio deve ser um número positivo"
    };
  }

  return {
    isValid: true
  };
}

/**
 * Cria contexto de auditoria para o spin
 */
export function createSpinAuditContext(
  username: string,
  twitchUser: { login: string; id: string } | null,
  prize: { tipo: string; valor: string },
  wheelId: string
) {
  return {
    timestamp: new Date().toISOString(),
    username,
    twitchUser: twitchUser ? {
      login: twitchUser.login,
      id: twitchUser.id
    } : null,
    prize,
    wheelId,
    userAgent: navigator.userAgent,
    sessionId: crypto.randomUUID()
  };
}