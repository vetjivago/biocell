import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { canAccessUnit } from "@/lib/patient-search";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

async function access(id: string) {
  const session = await getSession();
  if (!session) return { error: "Não autorizado", status: 401 } as const;
  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true, unitId: true } });
  if (!patient) return { error: "Paciente não encontrado", status: 404 } as const;
  if (!canAccessUnit(session, patient.unitId)) return { error: "Sem permissão", status: 403 } as const;
  return { session, patient } as const;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await access(id);
  if ("error" in a) return Response.json({ error: a.error }, { status: a.status });
  const photo = await prisma.patientPhoto.findUnique({ where: { patientId: id } });
  if (!photo) return Response.json({ error: "Sem foto" }, { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.mimeType, "Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff" },
  });
}

// Envia/substitui a foto do animal (multipart, campo "file"); a imagem já chega reduzida pelo navegador
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await access(id);
  if ("error" in a) return Response.json({ error: a.error }, { status: a.status });

  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Imagem não enviada" }, { status: 400 });
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return Response.json({ error: "Use uma imagem JPG, PNG ou WEBP" }, { status: 415 });
  if (file.size > MAX_PHOTO_BYTES) return Response.json({ error: "Imagem muito grande (máx. 2 MB)" }, { status: 413 });

  const data = Buffer.from(await file.arrayBuffer());
  await prisma.patientPhoto.upsert({
    where: { patientId: id },
    create: { patientId: id, mimeType: file.type, data },
    update: { mimeType: file.type, data },
  });
  await prisma.auditLog.create({
    data: { userId: a.session.id, action: "UPLOAD", entity: "PatientPhoto", entityId: id, details: JSON.stringify({ size: file.size }) },
  });
  return Response.json({ ok: true }, { status: 201 });
}
