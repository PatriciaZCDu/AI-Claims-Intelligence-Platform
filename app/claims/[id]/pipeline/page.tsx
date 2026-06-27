import { getClaimBundle } from "@/lib/data";
import { PipelineView } from "@/components/pipeline-view";

export const dynamic = "force-dynamic";

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getClaimBundle(id);
  return <PipelineView claimId={id} claimNumber={bundle?.claim.claim_number ?? id.slice(0, 8)} />;
}
