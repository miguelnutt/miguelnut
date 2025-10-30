/**
 * Utilitários para normalização de usernames da Twitch
 */

/**
 * Normaliza um username da Twitch garantindo que tenha @ no início
 * @param username - Username que pode ou não ter @
 * @returns Username normalizado com @
 */
export function normalizeUsername(username: string | null | undefined): string {
  if (!username) return "";
  
  // Remove espaços em branco
  const trimmed = username.trim();
  
  // Se já tem @, retorna como está
  if (trimmed.startsWith("@")) {
    return trimmed;
  }
  
  // Adiciona @ no início
  return `@${trimmed}`;
}

/**
 * Remove @ do início do username se existir
 * @param username - Username que pode ter @
 * @returns Username sem @
 */
export function removeAtSymbol(username: string | null | undefined): string {
  if (!username) return "";
  
  const trimmed = username.trim();
  
  if (trimmed.startsWith("@")) {
    return trimmed.substring(1);
  }
  
  return trimmed;
}

/**
 * Verifica se dois usernames são iguais, ignorando o @
 * @param username1 - Primeiro username
 * @param username2 - Segundo username
 * @returns true se são iguais (ignorando @)
 */
export function areUsernamesEqual(username1: string | null | undefined, username2: string | null | undefined): boolean {
  const clean1 = removeAtSymbol(username1).toLowerCase();
  const clean2 = removeAtSymbol(username2).toLowerCase();
  
  return clean1 === clean2 && clean1 !== "";
}

/**
 * Busca por username ignorando @ e case
 * @param searchTerm - Termo de busca
 * @param username - Username para comparar
 * @returns true se o username contém o termo de busca
 */
export function searchUsername(searchTerm: string | null | undefined, username: string | null | undefined): boolean {
  if (!searchTerm || !username) return false;
  
  const cleanSearch = removeAtSymbol(searchTerm).toLowerCase();
  const cleanUsername = removeAtSymbol(username).toLowerCase();
  
  return cleanUsername.includes(cleanSearch);
}