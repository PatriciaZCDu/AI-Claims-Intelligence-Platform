import { NextResponse } from "next/server";
import { requireAdmin, STORAGE_BUCKET } from "@/lib/supabase/admin";
import { getRole, CAN } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { evaluateImages, validationPasses, type ImageMeta } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  if (!CAN.createClaim(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let admin;
  try {
    admin = requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  const form = await req.formData();
  const metas = JSON.parse((form.get("meta") as string) || "[]") as ImageMeta[];
  const validations = evaluateImages(metas);

  const rows: Array<{
    claim_id: string;
    kind: string;
    storage_path: string;
    validation: (typeof validations)[number];
  }> = [];

  for (let i = 0; i < metas.length; i++) {
    const file = form.get(`file_${i}`) as File | null;
    if (!file) continue;
    const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${id}/${i}-${metas[i].kind}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const up = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(path, buf, { contentType: file.type, upsert: true });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

    const url = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    rows.push({ claim_id: id, kind: metas[i].kind, storage_path: url, validation: validations[i] });
  }

  if (rows.length) {
    const { error } = await admin.from("claim_images").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allPass = rows.length > 0 && validations.every(validationPasses);
  await admin.from("claims").update({ status: allPass ? "validated" : "intake" }).eq("id", id);
  await logAudit(admin, id, role, rows.length ? "Images Uploaded" : "No Images Provided", {
    count: rows.length,
    validationPassed: allPass,
  });

  return NextResponse.json({ validations, count: rows.length, validationPassed: allPass });
}
