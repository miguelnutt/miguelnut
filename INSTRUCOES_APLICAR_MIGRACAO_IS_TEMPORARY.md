# Instruções para Aplicar Migração is_temporary

## Problema Identificado
A coluna `is_temporary` não existe na tabela `profiles` do banco de dados, causando o erro:
```
column profiles.is_temporary does not exist
```

## Solução
Execute o script SQL `apply_is_temporary_migration.sql` no seu banco de dados Supabase.

## Como Aplicar

### Opção 1: Via Dashboard do Supabase
1. Acesse o dashboard do Supabase: https://app.supabase.com
2. Vá para o seu projeto
3. Navegue até "SQL Editor"
4. Copie e cole o conteúdo do arquivo `apply_is_temporary_migration.sql`
5. Execute o script

### Opção 2: Via CLI do Supabase (se instalado)
```bash
supabase db push
```

### Opção 3: Via psql (se disponível)
```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" -f apply_is_temporary_migration.sql
```

## O que o Script Faz
1. Verifica se as colunas `is_temporary` e `created_via` já existem
2. Adiciona as colunas se não existirem
3. Cria um índice para melhor performance
4. Adiciona comentários para documentação
5. Mostra o resultado final

## Após Aplicar a Migração
1. Recarregue a página do ranking de tickets
2. Os perfis temporários devem aparecer com o badge "Temporário"
3. Os logs de debug devem mostrar perfis temporários sendo processados

## Verificação
Após executar o script, você deve ver mensagens como:
- "Coluna is_temporary adicionada com sucesso"
- "Coluna created_via adicionada com sucesso"
- "Índice idx_profiles_is_temporary criado com sucesso"

E uma tabela mostrando as colunas criadas com seus tipos e valores padrão.