import type { LocateRequest } from "@/src/lib/study/link";

export type OpenedExcerpt = {
  id: string;
  text: string;
  anchor: unknown;
  documentId?: string;
};

export type ReaderEmbedProps = {
  documentId?: string;
  workspaceId?: string;
  embedded?: boolean;
  locate?: LocateRequest | null;
  onExcerptOpen?: (excerpt: OpenedExcerpt) => void;
  onExcerptCreated?: (excerpt: OpenedExcerpt) => void;
};
