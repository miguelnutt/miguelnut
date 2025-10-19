/**
 * Retorna o intervalo de início e fim do dia atual no timezone de Brasília
 * em formato ISO completo para usar em consultas Supabase
 */
export function getTodayRangeBrasilia(): { start: string; end: string } {
  const now = new Date();
  
  // Criar data no timezone de Brasília (America/Sao_Paulo)
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  // Início do dia (00:00:00)
  const startOfDay = new Date(brasiliaTime);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Fim do dia (23:59:59.999)
  const endOfDay = new Date(brasiliaTime);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Converter para ISO string mantendo o timezone
  return {
    start: startOfDay.toISOString(),
    end: endOfDay.toISOString()
  };
}

/**
 * Retorna a data atual no formato YYYY-MM-DD no timezone de Brasília
 */
export function getTodayDateBrasilia(): string {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  const year = brasiliaTime.getFullYear();
  const month = String(brasiliaTime.getMonth() + 1).padStart(2, '0');
  const day = String(brasiliaTime.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
