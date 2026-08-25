import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { addDocumentChunk, addPolicyDocument, listDocumentsForOrg } from "@/lib/repo";
import { chunkText, termFrequencies } from "@/lib/retrieval";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("org");
  if (!orgId) return NextResponse.json({ error: "org query param required" }, { status: 400 });
  return NextResponse.json({ documents: await listDocumentsForOrg(orgId) });
}

/**
 * Real PDF text extraction (pdf-parse, actual PyPDF-style parsing of the
 * uploaded bytes — not a filename echo), then real chunking + TF-IDF term
 * indexing (retrieval.ts) so the coverage assistant can search the actual
 * uploaded policy instead of the small sample-clause fallback library.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const orgId = formData.get("organization_id");
  const file = formData.get("file");

  if (typeof orgId !== "string" || !orgId) {
    return NextResponse.json({ error: "organization_id is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required (multipart/form-data)" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported in this prototype" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    text = result.text;
  } catch (err) {
    return NextResponse.json({ error: "Failed to parse PDF: " + String(err) }, { status: 422 });
  }

  if (!text || text.trim().length < 20) {
    return NextResponse.json({ error: "No extractable text found in this PDF (it may be a scanned image without OCR)" }, { status: 422 });
  }

  const docId = await addPolicyDocument(orgId, null, file.name, text);
  const chunks = chunkText(text);
  await Promise.all(chunks.map((chunk, i) => addDocumentChunk(docId, i, chunk, termFrequencies(chunk))));

  return NextResponse.json(
    { documentId: docId, filename: file.name, chunkCount: chunks.length, extractedChars: text.length },
    { status: 201 }
  );
}
