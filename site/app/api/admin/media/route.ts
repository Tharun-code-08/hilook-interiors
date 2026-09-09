import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createMedia, listMedia } from "@/lib/repos/operations";
import { requireSession } from "@/lib/api";
import { displayFilename, processUpload } from "@/lib/uploads";
import { putObject } from "@/lib/storage";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json(await listMedia());
}

export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  // Magic-byte sniff, SVG refusal, and a full re-encode happen here — the
  // declared MIME type and the chosen extension are never trusted.
  const result = await processUpload(file);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const id = nanoid();
  // Key built entirely from values we generated: a random id plus the
  // extension of the format we just encoded.
  const storageKey = `${id}.${result.extension}`;

  try {
    // Goes to the active storage driver — a bucket in production, .storage/
    // locally. Never into public/, which is what made the stored-XSS in
    // finding C2 reachable as same-origin HTML.
    await putObject(storageKey, result.buffer, result.contentType);
  } catch (error) {
    console.error("[hilook] upload storage write failed", error);
    return NextResponse.json(
      { error: "Couldn't save that file. Please try again." },
      { status: 500 }
    );
  }

  const media = await createMedia({
    id,
    filename: displayFilename(file.name),
    storageKey,
    contentType: result.contentType,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  });

  await tryRecordAudit({
    actor: guard.session,
    action: "upload",
    entity: "media",
    entityId: id,
    detail: `${media.filename} → ${result.width}×${result.height} ${result.extension}, ${Math.round(result.bytes / 1024)}KB`,
    ip: clientIp(req),
  });

  return NextResponse.json(media, { status: 201 });
}
