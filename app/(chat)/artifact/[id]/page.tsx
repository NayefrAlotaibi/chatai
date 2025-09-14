import { auth } from '@/app/(auth)/auth';
import { getDocumentsById } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { ArtifactPage } from '@/components/artifact-page';

interface ArtifactPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function Page({ params }: ArtifactPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;
  
  let documents;
  try {
    documents = await getDocumentsById({ id });
  } catch (error) {
    console.error('Failed to get documents:', error);
    redirect('/');
  }

  if (!documents || documents.length === 0) {
    redirect('/');
  }

  const document = documents[0];

  if (document.userId !== session.user.id) {
    redirect('/');
  }

  return <ArtifactPage document={document} />;
}
