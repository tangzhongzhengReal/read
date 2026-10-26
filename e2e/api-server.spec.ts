import { expect, test } from "@playwright/test";
import { buildTextPdf, SAMPLE_PAGE_ONE } from "../src/lib/pdf/text-pdf";

test("the standalone server serves the pdf upload API", async ({ request }) => {
  const bytes = Buffer.from(buildTextPdf([SAMPLE_PAGE_ONE]));
  const created = await request.post("/api/documents/upload", {
    multipart: {
      workspaceId: "api-e2e",
      title: "API PDF",
      file: {
        name: "api.pdf",
        mimeType: "application/pdf",
        buffer: bytes,
      },
    },
  });

  expect(created.status()).toBe(201);
  const body = (await created.json()) as {
    document: { id: string; storageKey: string; mediaType: string };
  };
  expect(body.document.mediaType).toBe("pdf");
  expect(body.document.storageKey).toContain("api-e2e/");

  const file = await request.get(
    `/api/documents/${body.document.id}/file?workspaceId=api-e2e`,
  );
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toContain("application/pdf");
  expect(Buffer.from(await file.body()).subarray(0, 5).toString("utf8")).toBe("%PDF-");
});
