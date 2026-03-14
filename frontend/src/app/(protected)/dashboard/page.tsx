import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Dashboard — Postable',
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border px-8 py-4 flex items-center justify-between">
        <span
          className="text-lg font-bold"
          style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
        >
          Postable
        </span>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">U</span>
        </div>
      </nav>

      <main className="px-8 py-12 max-w-5xl mx-auto">
        <h1
          className="text-2xl font-bold mb-8"
          style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
        >
          Dashboard
        </h1>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Seu conteúdo está chegando</CardTitle>
            <CardDescription>
              Em breve você verá seus posts e análises aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Seu conteúdo está sendo carregado...
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
