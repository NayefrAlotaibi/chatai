'use client';

import { useEffect, useState } from 'react';
import type { Document } from '@/lib/db/schema';
import { artifactDefinitions } from './artifact';
import { Button } from './ui/button';
import { CrossIcon } from './icons';
import { useRouter } from 'next/navigation';

interface ArtifactPageProps {
  document: Document;
}

export function ArtifactPage({ document }: ArtifactPageProps) {
  const router = useRouter();
  const [content, setContent] = useState(document.content || '');
  const [metadata, setMetadata] = useState<any>({});

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === document.kind,
  );

  useEffect(() => {
    // Initialize the artifact metadata like the regular artifact does
    if (artifactDefinition?.initialize) {
      artifactDefinition.initialize({
        documentId: document.id,
        setMetadata,
      });
    }
  }, [artifactDefinition, document.id]);

  if (!artifactDefinition) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Artifact not found</h1>
          <p className="text-muted-foreground">
            The requested artifact type is not supported.
          </p>
        </div>
      </div>
    );
  }

  const handleSaveContent = (updatedContent: string, debounce?: boolean) => {
    setContent(updatedContent);
    // TODO: Implement auto-save functionality if needed
  };

  // For sheet editor which expects different signature
  const handleSaveContentSheet = (updatedContent: string, isCurrentVersion: boolean) => {
    setContent(updatedContent);
    // TODO: Implement auto-save functionality if needed
  };

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      router.back();
    }
  };

  // Use the same content rendering as the regular artifact
  const ArtifactContent = artifactDefinition.content;

  // Debug logging
  console.log('Artifact Page Debug:', {
    kind: document.kind,
    contentLength: content?.length || 0,
    content: content?.substring(0, 100) + '...',
    metadata
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{document.title}</h1>
          <span className="text-sm text-muted-foreground">
            {document.kind.charAt(0).toUpperCase() + document.kind.slice(1)}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          <CrossIcon size={16} />
        </Button>
      </div>

      {/* Content - Use the same rendering as regular artifacts */}
      <div className="flex-1 overflow-hidden bg-background">
        {document.kind === 'sheet' ? (
          // Special handling for sheet to ensure proper props
          <div className="h-full p-4">
            <ArtifactContent
              title={document.title}
              content={content || 'A,B,C\n1,2,3\n4,5,6'}
              mode="edit"
              status="idle"
              currentVersionIndex={0}
              suggestions={[]}
              onSaveContent={handleSaveContentSheet}
              isInline={false}
              isCurrentVersion={true}
              getDocumentContentById={() => content}
              isLoading={false}
              metadata={metadata}
              setMetadata={setMetadata}
            />
          </div>
        ) : (
          <ArtifactContent
            title={document.title}
            content={content}
            mode="edit"
            status="idle"
            currentVersionIndex={0}
            suggestions={[]}
            onSaveContent={handleSaveContent}
            isInline={false}
            isCurrentVersion={true}
            getDocumentContentById={() => content}
            isLoading={false}
            metadata={metadata}
            setMetadata={setMetadata}
          />
        )}
      </div>
    </div>
  );
}
