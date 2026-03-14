import { redirect } from 'next/navigation';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const error = params['error'];
  const errorDescription = params['error_description'];

  if (error) {
    const query = new URLSearchParams({ error, ...(errorDescription ? { error_description: errorDescription } : {}) });
    redirect(`/login?${query}`);
  }

  redirect('/login');
}
