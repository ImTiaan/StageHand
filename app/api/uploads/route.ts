import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";

type AssetType = "IMAGE" | "VIDEO";

const toAssetType = (mimeType: string): AssetType | null => {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  return null;
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const assetType = toAssetType(file.type);
  if (!assetType) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const safeFilename = file.name.replace(/\s+/g, "-");
  const blob = await put(`${userData.user.id}/${Date.now()}-${safeFilename}`, file, {
    access: "public",
  });

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      type: assetType,
      url: blob.url,
      filename: file.name,
      metadata: {
        mimeType: file.type,
        size: file.size,
      },
      uploader_id: userData.user.id,
      approved: false,
    })
    .select("*")
    .single();

  if (assetError) {
    return NextResponse.json({ error: assetError.message }, { status: 500 });
  }

  return NextResponse.json({ asset });
}
