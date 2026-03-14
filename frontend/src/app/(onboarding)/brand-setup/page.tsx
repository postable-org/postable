import BrandSetupWizard from '@/components/forms/BrandSetupWizard';

export default function BrandSetupPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border px-8 py-4">
        <span
          className="text-lg font-bold"
          style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
        >
          Postable
        </span>
      </div>
      <div className="flex items-center justify-center p-8 min-h-[calc(100vh-57px)]">
        <div className="w-full max-w-lg">
          <div className="mb-8">
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
            >
              Configure sua Marca
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Alguns detalhes para personalizar seu conteúdo.
            </p>
          </div>
          <BrandSetupWizard />
        </div>
      </div>
    </main>
  );
}
