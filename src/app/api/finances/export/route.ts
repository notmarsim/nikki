import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { sanitizeCsvCell } from "@/modules/finances/money";
import { getFinanceOverview } from "@/modules/finances/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getFinanceOverview({
    userId: session.user.id,
    workspaceId: workspace.id,
  });

  if (format === "json") {
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="nikki-finances.json"',
      },
    });
  }

  const header = ["Date", "Type", "Status", "Description", "Amount", "Currency"].join(",");
  const rows = data.transactions.map((t) =>
    [
      sanitizeCsvCell(t.transactionDate),
      sanitizeCsvCell(t.type),
      sanitizeCsvCell(t.status),
      sanitizeCsvCell(t.description),
      sanitizeCsvCell((t.amountCents / 100).toFixed(2)),
      sanitizeCsvCell(t.currency),
    ].join(",")
  );

  return new NextResponse([header, ...rows].join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nikki-finances.csv"',
    },
  });
}
