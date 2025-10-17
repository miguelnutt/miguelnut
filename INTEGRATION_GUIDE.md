# 🔌 Guia de Integração - Como Usar o Login Twitch no Seu Código

Agora que o login está configurado, veja como usar nos seus componentes.

---

## 📦 Componentes e Hooks Disponíveis

### 1. `TwitchLoginButton` - Botão de Login

**Onde usar:** Qualquer página onde você queira que o usuário faça login.

```tsx
import { TwitchLoginButton } from '@/components/TwitchLoginButton';

function MinhaPageDeLogin() {
  return (
    <div>
      <h1>Faça Login</h1>
      <TwitchLoginButton />
    </div>
  );
}
```

### 2. `useTwitchAuth()` - Hook de Autenticação

**Onde usar:** Qualquer componente que precise saber se o usuário está logado.

```tsx
import { useTwitchAuth } from '@/hooks/useTwitchAuth';

function MeuComponente() {
  const { user, loading, logout } = useTwitchAuth();

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!user) {
    return <div>Você precisa fazer login</div>;
  }

  return (
    <div>
      <img src={user.profile_image_url} alt={user.display_name} />
      <p>Olá, {user.display_name}!</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}
```

---

## 🎯 Exemplos Práticos

### Exemplo 1: Navbar com Login/Logout

```tsx
import { useTwitchAuth } from '@/hooks/useTwitchAuth';
import { TwitchLoginButton } from '@/components/TwitchLoginButton';
import { Button } from '@/components/ui/button';

function Navbar() {
  const { user, loading, logout } = useTwitchAuth();

  return (
    <nav className="flex items-center justify-between p-4">
      <h1>Meu Site</h1>
      
      {loading ? (
        <div>Carregando...</div>
      ) : user ? (
        <div className="flex items-center gap-4">
          <img 
            src={user.profile_image_url} 
            alt={user.display_name}
            className="w-8 h-8 rounded-full"
          />
          <span>{user.display_name}</span>
          <Button onClick={logout} variant="outline">
            Sair
          </Button>
        </div>
      ) : (
        <TwitchLoginButton />
      )}
    </nav>
  );
}
```

### Exemplo 2: Página Protegida (Só para Usuários Logados)

```tsx
import { useTwitchAuth } from '@/hooks/useTwitchAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function PaginaProtegida() {
  const { user, loading } = useTwitchAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!user) {
    return null; // Será redirecionado
  }

  return (
    <div>
      <h1>Área Exclusiva</h1>
      <p>Bem-vindo, {user.display_name}!</p>
      <p>Seu Twitch ID: {user.twitch_user_id}</p>
    </div>
  );
}
```

### Exemplo 3: Botão de Ação que Requer Login

```tsx
import { useTwitchAuth } from '@/hooks/useTwitchAuth';
import { TwitchLoginButton } from '@/components/TwitchLoginButton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function ComponenteComAcao() {
  const { user } = useTwitchAuth();

  const handleAction = () => {
    if (!user) {
      toast.error('Você precisa estar logado!');
      return;
    }

    // Fazer algo apenas para usuários logados
    console.log('Usuário logado:', user.login);
    toast.success('Ação realizada!');
  };

  return (
    <div>
      <h2>Clique no Botão</h2>
      
      {user ? (
        <Button onClick={handleAction}>
          Fazer Ação Restrita
        </Button>
      ) : (
        <div>
          <p>Você precisa fazer login primeiro:</p>
          <TwitchLoginButton />
        </div>
      )}
    </div>
  );
}
```

---

## 📊 Dados do Usuário Disponíveis

Quando o usuário está logado, `user` contém:

```typescript
{
  twitch_user_id: string;        // ID único do usuário na Twitch
  login: string;                 // Nome de usuário (lowercase, sem espaços)
  display_name: string;          // Nome de exibição (como aparece na Twitch)
  profile_image_url: string;     // URL do avatar
  email?: string;                // Email (se o usuário autorizou)
}
```

### Exemplo de Uso:

```tsx
const { user } = useTwitchAuth();

// Mostrar avatar
<img src={user.profile_image_url} alt={user.display_name} />

// Link para o perfil da Twitch
<a href={`https://twitch.tv/${user.login}`}>
  Ver perfil no Twitch
</a>

// Usar o ID para salvar no banco
await salvarNoBanco({
  twitch_user_id: user.twitch_user_id,
  nome: user.display_name
});
```

---

## 🔄 Atualizar Estado de Login

Se você fez logout/login em outro lugar e quer atualizar:

```tsx
const { refreshAuth } = useTwitchAuth();

// Atualizar o estado
await refreshAuth();
```

---

## 🚪 Fazer Logout

```tsx
const { logout } = useTwitchAuth();

// Fazer logout
await logout();
```

---

## 🔐 Verificar Login Programaticamente

```tsx
import { supabase } from '@/integrations/supabase/client';

async function verificarLogin() {
  const { data } = await supabase.functions.invoke('twitch-auth-me');
  
  if (data.success && data.user) {
    console.log('Usuário logado:', data.user);
    return data.user;
  } else {
    console.log('Usuário não está logado');
    return null;
  }
}
```

---

## 🎨 Customizar o Botão de Login

Se quiser customizar o visual:

```tsx
// Criar seu próprio botão
import { FaTwitch } from 'react-icons/fa';

function MeuBotaoCustomizado() {
  const handleLogin = async () => {
    // Copiar a lógica do TwitchLoginButton.tsx
    // ...
  };

  return (
    <button 
      onClick={handleLogin}
      className="meu-estilo-customizado"
    >
      <FaTwitch /> Login Twitch Customizado
    </button>
  );
}
```

---

## ⚡ Dicas de Performance

1. **Use o hook uma vez por página/componente principal:**
   ```tsx
   // ✅ BOM
   function App() {
     const { user } = useTwitchAuth();
     return <Navbar user={user} />;
   }

   // ❌ EVITE
   function ComponenteA() {
     const { user } = useTwitchAuth(); // Chamada 1
   }
   function ComponenteB() {
     const { user } = useTwitchAuth(); // Chamada 2
   }
   ```

2. **Passe o user como prop:**
   ```tsx
   function Navbar({ user }) {
     return <div>{user?.display_name}</div>;
   }
   ```

---

## 🐛 Debug

### Verificar se o usuário está logado (Console do navegador):

```javascript
// Ver cookie
document.cookie

// Testar API
fetch('https://qkwctrccuqkjygqurqxt.supabase.co/functions/v1/twitch-auth-me', {
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

---

## 📝 Resumo Rápido

| Ação | Como Fazer |
|------|------------|
| Adicionar botão de login | `<TwitchLoginButton />` |
| Verificar se está logado | `const { user } = useTwitchAuth()` |
| Mostrar dados do usuário | `user.display_name`, `user.profile_image_url` |
| Fazer logout | `const { logout } = useTwitchAuth(); logout()` |
| Atualizar estado | `const { refreshAuth } = useTwitchAuth(); refreshAuth()` |
| Proteger página | Redirecionar se `!user` |

---

Pronto! Agora você sabe como usar o login Twitch em qualquer lugar do seu código! 🎉
