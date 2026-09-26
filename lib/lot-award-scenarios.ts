export type LotOffer = {
  lotId: string;
  bidId: string;
  supplierId: string;
  supplierName: string;
  price: number;
};

export type LotScenario = {
  name: string;
  method: string;
  total: number;
  supplierCount: number;
  allocations: LotOffer[];
};

export function modelLotAwards(
  lotIds: string[],
  offers: LotOffer[],
  limits: { maxLotsPerSupplier: number; minSuppliers: number; budgetCap?: number },
): LotScenario[] {
  const orderedLots = [...new Set(lotIds)];
  const validOffers = offers.filter((offer) =>
    orderedLots.includes(offer.lotId) &&
    Number.isSafeInteger(Math.round(offer.price * 100)) &&
    Number.isFinite(offer.price) && offer.price >= 0,
  );
  const byPrice = (a: LotOffer, b: LotOffer) =>
    a.price - b.price || a.supplierName.localeCompare(b.supplierName) || a.bidId.localeCompare(b.bidId);
  const candidates = new Map(orderedLots.map((id) => [id, validOffers.filter((offer) => offer.lotId === id).sort(byPrice)]));
  if (!orderedLots.length || [...candidates.values()].some((list) => !list.length)) return [];
  const scenarios: LotScenario[] = [];
  function add(name: string, method: string, allocations: LotOffer[]) {
    if (allocations.length !== orderedLots.length) return;
    const counts = new Map<string, number>();
    for (const offer of allocations) counts.set(offer.supplierId, (counts.get(offer.supplierId) || 0) + 1);
    const total = allocations.reduce((sum, offer) => sum + offer.price, 0);
    if (counts.size < limits.minSuppliers || [...counts.values()].some((count) => count > limits.maxLotsPerSupplier)) return;
    if (limits.budgetCap != null && total > limits.budgetCap) return;
    if (scenarios.some((scenario) => scenario.allocations.every((offer, index) => offer.bidId === allocations[index].bidId))) return;
    scenarios.push({ name, method, total, supplierCount: counts.size, allocations });
  }
  add("Lowest listed price per lot", "Independent price minimum; not a compliance finding.", orderedLots.map((id) => candidates.get(id)![0]));
  const supplierIds = [...new Set(validOffers.map((offer) => offer.supplierId))].sort();
  let bestSingle: LotOffer[] | null = null;
  for (const supplierId of supplierIds) {
    const allocation = orderedLots.map((id) => candidates.get(id)!.find((offer) => offer.supplierId === supplierId));
    if (allocation.every((offer) => offer != null)) {
      const complete = allocation as LotOffer[];
      if (!bestSingle || complete.reduce((sum, offer) => sum + offer.price, 0) < bestSingle.reduce((sum, offer) => sum + offer.price, 0)) bestSingle = complete;
    }
  }
  if (bestSingle) add("One supplier for every lot", "Lowest complete single-supplier offer found; not a compliance finding.", bestSingle);
  // A transparent greedy comparison, not a globally optimal constrained solver.
  const counts = new Map<string, number>();
  const diversified: LotOffer[] = [];
  for (const id of orderedLots) {
    const eligible = candidates.get(id)!.filter((offer) => (counts.get(offer.supplierId) || 0) < limits.maxLotsPerSupplier);
    const choice = [...eligible].sort((a, b) => (counts.get(a.supplierId) || 0) - (counts.get(b.supplierId) || 0) || byPrice(a, b))[0];
    if (!choice) break;
    diversified.push(choice);
    counts.set(choice.supplierId, (counts.get(choice.supplierId) || 0) + 1);
  }
  add("Diversified supplier comparison", "Greedy spread across suppliers; may miss a cheaper feasible allocation.", diversified);
  return scenarios.sort((a, b) => a.total - b.total).slice(0, 3);
}
