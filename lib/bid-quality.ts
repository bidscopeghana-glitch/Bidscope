export type BidQualityInput = {
  bidPrice?: number | null;
  technicalResponse: string;
  methodologyResponse: string;
  experienceResponse: string;
  complianceDeclarations: Record<string, boolean>;
  lotResponses: Array<{ lotId: string; price?: number | null; response: string }>;
  responses: Array<{ requirementId?: string | null; responseText: string }>;
};

export type BidQualityContext = {
  requirements: Array<{ id: string; title: string; mandatory: boolean }>;
  requiredDocuments: Array<{ id: string; name: string; mandatory: boolean }>;
  uploadedDocumentIds: string[];
  lotIds: string[];
};

export type BidQualityReport = {
  critical: string[];
  warnings: string[];
  suggestions: string[];
  passed: string[];
};

export function bidReferencesValid(
  bid: { responses: Array<{ requirementId?: string | null; criterionId?: string | null }>; lotResponses: Array<{ lotId: string }> },
  allowed: { requirementIds: string[]; criterionIds: string[]; lotIds: string[] },
) {
  const requirements = bid.responses.map(item => item.requirementId).filter((id): id is string => Boolean(id));
  const criteria = bid.responses.map(item => item.criterionId).filter((id): id is string => Boolean(id));
  const lots = bid.lotResponses.map(item => item.lotId);
  return [
    [requirements, allowed.requirementIds],
    [criteria, allowed.criterionIds],
    [lots, allowed.lotIds],
  ].every(([submitted, valid]) => {
    const allowedIds = new Set(valid);
    return new Set(submitted).size === submitted.length && submitted.every(id => allowedIds.has(id));
  });
}

// This deterministic check covers structured bid fields only. It does not certify document contents.
export function checkBidQuality(bid: BidQualityInput, context: BidQualityContext): BidQualityReport {
  const report: BidQualityReport = { critical: [], warnings: [], suggestions: [], passed: [] };
  const responses = new Map(bid.responses.map(item => [item.requirementId, item.responseText.trim()]));
  const uploaded = new Set(context.uploadedDocumentIds);

  if (!bid.technicalResponse.trim()) report.critical.push("Technical response is missing.");
  else report.passed.push("Technical response supplied.");

  if (bid.complianceDeclarations.confirmed !== true) report.critical.push("Supplier accuracy and authority declaration is not confirmed.");
  else report.passed.push("Supplier declaration confirmed.");

  const unanswered = context.requirements.filter(item => item.mandatory && !responses.get(item.id));
  for (const item of unanswered) report.critical.push(`Mandatory requirement unanswered: ${item.title}.`);
  if (context.requirements.some(item => item.mandatory) && !unanswered.length) report.passed.push("All mandatory requirement responses supplied.");

  const missingDocuments = context.requiredDocuments.filter(item => item.mandatory && !uploaded.has(item.id));
  for (const item of missingDocuments) report.critical.push(`Mandatory upload missing: ${item.name}. Save a draft to upload documents first.`);
  if (context.requiredDocuments.some(item => item.mandatory) && !missingDocuments.length) report.passed.push("All mandatory document slots have uploads.");

  if (context.lotIds.length && !bid.lotResponses.length) report.critical.push("Select at least one lot to bid on.");
  for (const lot of bid.lotResponses) {
    if (lot.price === null || lot.price === undefined) report.critical.push("A selected lot is missing its price.");
  }
  if (bid.lotResponses.length && bid.lotResponses.every(lot => lot.price !== null && lot.price !== undefined)) report.passed.push("Selected lots have prices.");

  if (bid.bidPrice === null || bid.bidPrice === undefined) report.warnings.push("No overall bid price entered. Check whether this buyer expects one in addition to lot prices.");
  else report.passed.push("Overall bid price supplied.");
  if (!bid.methodologyResponse.trim()) report.suggestions.push("Consider adding a project methodology if the tender requests one.");
  if (!bid.experienceResponse.trim()) report.suggestions.push("Consider citing relevant experience and supporting evidence.");
  return report;
}
