'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.push('/brand-setup'), 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="text-center space-y-4">
      <h1
        className="text-3xl font-bold"
        style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
      >
        Bem-vindo ao Postable!
      </h1>
      <p className="text-sm text-muted-foreground">
        Vamos configurar sua marca...
      </p>
      <div className="flex justify-center mt-6">
        <span className="animate-spin h-6 w-6 border-2 border-foreground border-t-transparent rounded-full" />
      </div>
    </div>
  );
}
