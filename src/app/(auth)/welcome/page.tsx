'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    // Brief welcome, then redirect to brand setup
    const timer = setTimeout(() => router.push('/brand-setup'), 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Bem-vindo ao Postable!</h1>
        <p className="text-muted-foreground mt-2">Vamos configurar sua marca...</p>
      </div>
    </main>
  );
}
