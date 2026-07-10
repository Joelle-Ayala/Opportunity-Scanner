import { handleLeadMagnetAccessRequest } from "@/lib/leadMagnets";
import { saveLeadMagnetCapture } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleLeadMagnetAccessRequest(request, {
    saveCapture: saveLeadMagnetCapture
  });
}
