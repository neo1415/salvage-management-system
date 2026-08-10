interface VendorBid {
  amount: string | number;
  vendorId: string;
}

interface VendorBidState {
  bids: VendorBid[];
  currentBid: string | number | null;
  currentBidder: string | null;
}

function toValidBidAmount(value: string | number | null): number | null {
  if (value === null || value === '') {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function getVendorCurrentBid(
  auction: VendorBidState,
  vendorId: string
): number | null {
  const recordedAmounts = auction.bids
    .filter((bid) => bid.vendorId === vendorId)
    .map((bid) => toValidBidAmount(bid.amount))
    .filter((amount): amount is number => amount !== null);

  if (auction.currentBidder === vendorId) {
    const authoritativeCurrentBid = toValidBidAmount(auction.currentBid);
    if (authoritativeCurrentBid !== null) {
      recordedAmounts.push(authoritativeCurrentBid);
    }
  }

  return recordedAmounts.length > 0 ? Math.max(...recordedAmounts) : null;
}
