import { handleAcpRoute } from "../../../../../lib/application/acp-runtime.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  return handleAcpRoute(request, { operation: "delegate-payment" });
}
