import { NextResponse } from "next/server";
import { getCompanyProfile, getScan, listProfileFeedbackForScan } from "@/lib/storage";
import { buildProfileSearchStrategy, ensureProfileRefinementFields } from "@/lib/profileRefinement";
import { hasAdminAccess } from "@/lib/access";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { scanId: string } }) {
  const scan = await getScan(params.scanId);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }
  const access = new URL(request.url).searchParams.get("access") ?? undefined;
  if (!hasAdminAccess(access, scan)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const profileRecord = await getCompanyProfile(scan.id);
  if (!profileRecord) {
    return NextResponse.json({ error: "Company profile not found." }, { status: 404 });
  }

  const profile = ensureProfileRefinementFields(profileRecord.profile_json);
  const feedback = await listProfileFeedbackForScan(scan.id);

  return NextResponse.json({
    scan_id: scan.id,
    company_profile_id: profileRecord.id,
    profile,
    search_strategy: buildProfileSearchStrategy(profile),
    feedback
  });
}
