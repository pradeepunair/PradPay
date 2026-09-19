import { handleAcpRoute } from "../../../../../lib/application/acp-runtime.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkoutSessionId(context) {
  const params = await context.params;
  return params.checkoutSessionId;
}

export async function GET(request, context) {
  return handleAcpRoute(request, {
    operation: "retrieve",
    checkoutSessionId: await checkoutSessionId(context),
  });
}

export async function POST(request, context) {
  return handleAcpRoute(request, {
    operation: "update",
    checkoutSessionId: await checkoutSessionId(context),
  });
}
