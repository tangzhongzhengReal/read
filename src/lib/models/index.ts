import { z } from "zod";

const timestamp = z.string().datetime();

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const DocumentSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  mediaType: z.enum(["pdf", "epub"]),
  storageKey: z.string().min(1),
  contentHash: z.string().min(1),
  title: z.string().min(1),
  meta: z.record(z.string(), z.unknown()).optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  deleted: z.boolean().optional(),
});

export const NodeSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  documentId: z.string().min(1).optional(),
  type: z.enum(["excerpt", "note", "code"]),
  payload: z.record(z.string(), z.unknown()),
  anchor: z.record(z.string(), z.unknown()).optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  deleted: z.boolean().optional(),
});

export const EdgeSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  kind: z.string().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
  deleted: z.boolean().optional(),
});

export const CodeRunSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  language: z.enum(["javascript", "python", "go"]),
  source: z.string(),
  stdin: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const excerptRectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});

export const PdfExcerptAnchorSchema = z.object({
  page: z.number().int().positive(),
  rects: z.array(excerptRectSchema).min(1),
});

export const EpubExcerptAnchorSchema = z.object({
  cfi: z.string().regex(/^epubcfi\([\s\S]+\)$/),
});

export const ExcerptAnchorSchema = z.union([
  PdfExcerptAnchorSchema,
  EpubExcerptAnchorSchema,
]);

export const ExcerptCreateSchema = z.object({
  workspaceId: z.string().min(1),
  documentId: z.string().min(1),
  type: z.literal("excerpt"),
  payload: z.object({
    text: z.string().trim().min(1),
  }),
  anchor: ExcerptAnchorSchema,
});

export const DocumentCreateSchema = DocumentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deleted: true,
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type DocumentCreate = z.infer<typeof DocumentCreateSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type CodeRun = z.infer<typeof CodeRunSchema>;
