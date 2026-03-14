import BrandSetupWizard from '@/components/forms/BrandSetupWizard';

export default function BrandSetupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-8 text-center">Configure sua Marca</h1>
        <BrandSetupWizard />
      </div>
    </main>
  );
}
