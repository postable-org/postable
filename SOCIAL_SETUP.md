# Configuração das redes sociais (Postable)

Guia completo para configurar OAuth e publicação nas redes sociais.

---

## Parte 1: Configuração do administrador (uma vez)

### 1.1 Variáveis de ambiente do backend

Edite `postable/backend/.env` e adicione:

```env
# Obrigatório para OAuth funcionar
API_BASE_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000

# Meta (Instagram + Facebook)
FACEBOOK_APP_ID=seu_app_id
FACEBOOK_APP_SECRET=seu_app_secret

# LinkedIn (opcional)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# X (opcional)
X_CLIENT_ID=
# opcional para apps confidenciais
X_CLIENT_SECRET=
```

- **API_BASE_URL**: URL pública do backend. Em produção: `https://api.seudominio.com`
- **FRONTEND_URL**: URL do frontend. Em produção: `https://app.seudominio.com`
- **SUPABASE_JWT_SECRET**: Em Supabase: **Project Settings** → **API** → **JWT Settings** → **JWT Secret**. Use exatamente esse valor (não o anon key). Se estiver errado, o OAuth retorna 401.

### 1.2 Banco de dados – rodar migrations

As tabelas `social_connections` e `social_post_jobs` são criadas pelas migrations. No **Supabase Dashboard** → **SQL Editor**:

1. Rode o conteúdo de `postable/backend/db/migrations/004_social_publishing.sql`
2. Depois rode `005_social_network_expansion.sql`

Ou execute na ordem: 001 → 002 → 003 → 004 → 005 (se ainda não rodou nenhuma).

**Erro "social_post_jobs does not exist"?** As migrations 004 e 005 não foram aplicadas.

### 1.3 Criar app no Meta (para Instagram e Facebook)

1. Acesse [developers.facebook.com](https://developers.facebook.com) e crie um app do tipo **"Business"**.
2. No menu lateral: **App Settings** → **Basic** → copie o **App ID** e **App Secret** para o `.env`.
3. Em **Use cases**, adicione:
   - **Authenticate and request data from users with Facebook Login**
   - **Instagram Graph API** (para publicar no Instagram)
4. **Facebook Login** → **Settings**:
   - **Valid OAuth Redirect URIs**: `http://localhost:8080/api/social/oauth/facebook/callback`
   - Em produção: `https://seu-api.com/api/social/oauth/facebook/callback`
5. **App Review**: solicite as permissões `pages_manage_posts`, `instagram_content_publish`, `pages_show_list` (em modo desenvolvimento você pode usar sem aprovação, apenas com testadores).

---

## Parte 2: Passo a passo para o usuário conectar

### Instagram ou Facebook

1. **Faça login** no Postable (a página /social exige login).
2. Vá em **Social** no menu.
3. Selecione **Instagram** ou **Facebook**.
4. Clique em **Conectar [rede] via OAuth oficial**.
5. Será redirecionado para o login da Meta. Autorize o app.
6. Você volta para o Postable com a conta conectada.

**Erro 401?** Faça logout e login novamente. O token JWT pode ter expirado.

**Erro "oauth is not configured"?** O backend não tem `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET` no `.env`.

### X (Twitter)

O X já suporta conexão via OAuth oficial:

1. Vá em [developer.x.com](https://developer.x.com) e crie um app com **User authentication (OAuth 2.0)**.
2. Configure o callback URI para: `{API_BASE_URL}/api/social/oauth/x/callback`.
3. Use os escopos: `tweet.read tweet.write users.read offline.access`.
4. No backend, configure `X_CLIENT_ID` (e opcionalmente `X_CLIENT_SECRET`) no `.env`.
4. No Postable, abra **Social** → **X** e clique em **Conectar X via OAuth oficial**.
5. Autorize o app e aguarde o redirecionamento de volta para `/social`.

### LinkedIn

1. Crie um app em [LinkedIn Developers](https://www.linkedin.com/developers/).
2. Adicione o produto de login compatível com OpenID Connect e o produto de compartilhamento no LinkedIn.
3. Cadastre o redirect URI: `{API_BASE_URL}/api/social/oauth/linkedin/callback`.
4. Garanta os escopos base: `openid profile email w_member_social`.
5. (Opcional) Para refresh token automático, habilite também `offline_access` no app e configure `LINKEDIN_ENABLE_OFFLINE_ACCESS=true` no `.env`.
6. Configure `LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET` no `.env`.

- LinkedIn: `{API_BASE_URL}/api/social/oauth/linkedin/callback`

---

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| 401 Unauthorized | Sessão expirada ou token inválido | Faça logout e login novamente |
| oauth is not configured | Variáveis do provider faltando no .env | Adicione FACEBOOK_APP_ID, etc. |
| social_post_jobs does not exist | Migrations não rodaram | Execute 004 e 005 no banco |
| Redirect URI mismatch | URL de callback errada no Meta | Confira API_BASE_URL e config no Meta |
