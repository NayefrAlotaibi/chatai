import { Artifact } from '@/components/create-artifact';
import { Receipt } from '@/components/receipt';
import { FullscreenIcon } from '@/components/icons';

type ReceiptMetadata = {
  data?: any;
};

export const receiptArtifact = new Artifact<'receipt', ReceiptMetadata>({
  kind: 'receipt',
  description: 'Shows structured receipt information with items and totals.',
  initialize: async () => {},
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    if (streamPart.type === 'data-receipt') {
      setMetadata((prev) => ({ ...prev, data: streamPart.data }));
      setArtifact((draft) => ({
        ...draft,
        // Keep artifact content as CSV/text mirror if needed; not strictly required
        isVisible: true,
        status: 'streaming',
      }));
    }
  },
  content: ({ metadata }) => {
    return <Receipt data={metadata?.data || {}} />;
  },
  actions: [
    {
      icon: <FullscreenIcon size={18} />,
      description: 'Open in full page',
      onClick: ({ documentId }) => {
        if (documentId && documentId !== 'init') {
          const artifactUrl = `/artifact/${documentId}`;
          window.open(artifactUrl, '_blank');
        }
      },
    },
  ],
  toolbar: [],
});


