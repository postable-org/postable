# Postable

Plataforma SaaS de gestão e geração de conteúdo para redes sociais voltada para pequenas e médias empresas brasileiras. Com inteligência artificial, o Postable analisa tendências locais, mapeia concorrentes e gera posts prontos para publicação em múltiplas redes sociais — tudo em um único produto.

Este repositório contém o **frontend** (Next.js) e o **backend** (Go) da aplicação principal.

**Deploy:** [app.thepostable.com](https://app.thepostable.com)

---

## Membros da Equipe

| Nome | Função |
|------|--------|
| Fabio Missiaggia Brugnara | Tech Lead |
| Rafael Xavier Oliveira | Dev |
| Luca Guimarães Lodi | Design UI/UX |
| Leonardo Stuart de Almeida Ramalho | Produto |

---

## Tecnologias

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query 5
- **Backend**: Go 1.23, chi v5, PostgreSQL (pgx v5), JWT, Stripe
- **Auth & Storage**: Supabase Auth + Supabase Storage
- **Testes**: Vitest 2 + React Testing Library (frontend), Go testing (backend)

---

## Configuração

### Pré-requisitos

- Node.js 22+
- Go 1.23+
- Docker e Docker Compose
- Conta no [Supabase](https://supabase.com/) com as migrations aplicadas
- Conta no [Stripe](https://stripe.com/)

### Variáveis de ambiente

**Frontend** — crie `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_BASIC_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ADVANCED_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ADVANCED_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_AGENCY_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_AGENCY_YEARLY=price_...
```

**Backend** — crie `backend/.env`:

```env
PORT=8080
API_BASE_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://<projeto>.supabase.co
SUPABASE_JWT_SECRET=<jwt-secret>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
DATABASE_URL=postgresql://user:password@host:5432/postgres

PYTHON_AGENT_URL=http://localhost:8000
ALLOWED_ORIGINS=http://localhost:3000

FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
X_CLIENT_ID=
X_CLIENT_SECRET=

STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_BASIC_YEARLY=price_...
STRIPE_PRICE_ADVANCED_MONTHLY=price_...
STRIPE_PRICE_ADVANCED_YEARLY=price_...
STRIPE_PRICE_AGENCY_MONTHLY=price_...
STRIPE_PRICE_AGENCY_YEARLY=price_...
```

### Banco de dados

Execute as migrations em ordem no SQL Editor do Supabase:

```
backend/db/migrations/001_initial_schema.sql
backend/db/migrations/002_rls_policies.sql
backend/db/migrations/003_competitor_analysis.sql
backend/db/migrations/004_social_publishing.sql
backend/db/migrations/005_social_network_expansion.sql
backend/db/migrations/006_brand_name_context.sql
backend/db/migrations/007_brand_assets.sql
backend/db/migrations/008_post_images_bucket.sql
backend/db/migrations/009_post_columns.sql
backend/db/migrations/010_subscriptions.sql
backend/db/migrations/011_post_placement.sql
backend/db/migrations/012_extended_brand_context.sql
```

---

## Uso

### Com Docker Compose

```bash
docker compose up --build
```

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8080 |
| Agente de IA | http://localhost:8000 |

### Desenvolvimento local

```bash
# Backend
cd backend
go run ./cmd/server/main.go

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

### Scripts do frontend

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Servidor de produção
npm run lint         # ESLint
npm run test:unit    # Testes unitários
npm run test:watch   # Testes em modo watch
```

### Testes

```bash
# Frontend
cd frontend && npm run test:unit

# Backend
cd backend && go test ./...
```

---

## Estrutura do Projeto

```
postable/
├── backend/
│   ├── cmd/server/main.go       # Entry point
│   ├── internal/
│   │   ├── handler/             # HTTP handlers
│   │   ├── service/             # Lógica de negócio
│   │   ├── middleware/          # Auth JWT + subscription
│   │   └── storage/             # Supabase Storage
│   └── db/migrations/           # 12 migrations SQL
├── frontend/
│   └── src/
│       ├── app/                 # App Router (auth, onboarding, dashboard, posts, social...)
│       ├── components/          # Componentes UI
│       └── lib/                 # Utilitários e clientes de API
└── docker-compose.yml
```

---

## Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](./LICENSE) para mais informações.
