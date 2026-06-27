import { getRole, CAN, roleLabel } from "@/lib/rbac";
import { Card, PageHeader } from "@/components/ui";
import { NewClaimForm } from "@/components/new-claim-form";

export const dynamic = "force-dynamic";

export default async function NewClaimPage() {
  const role = await getRole();

  if (!CAN.createClaim(role)) {
    return (
      <div>
        <PageHeader title="Create Claim" />
        <Card className="border-amber-200 bg-amber-50">
          <p className="p-5 text-sm text-amber-800">
            The <strong>{roleLabel(role)}</strong> role cannot create claims. Switch to Claims
            Adjuster or Senior Adjuster using the role selector in the top bar.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Create Claim"
        subtitle="Capture the claim, validate the photos, then run the AI assessment pipeline"
      />
      <NewClaimForm />
    </div>
  );
}
