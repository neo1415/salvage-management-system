export type EvidenceNarrativeEvent = {
  at: Date;
  description: string;
};

type AuctionSnapshot = {
  startTime?: Date | null;
  endTime?: Date | null;
  currentBid?: string | number | null;
  status?: string | null;
  pickupConfirmedVendor?: boolean | null;
  pickupConfirmedVendorAt?: Date | null;
  pickupConfirmedAdmin?: boolean | null;
  pickupConfirmedAdminAt?: Date | null;
};

type BidSnapshot = {
  vendorName: string;
  amount: string | number;
  status?: string | null;
  createdAt: Date;
};

type PaymentSnapshot = {
  vendorName: string;
  amount: string | number;
  status: string;
  verifiedAt?: Date | null;
  createdAt: Date;
};

type DocumentSnapshot = {
  vendorName: string;
  title?: string | null;
  documentType: string;
  status: string;
  signedAt?: Date | null;
  createdAt: Date;
};

type PickupEvidenceSnapshot = {
  vendorName: string;
  createdAt: Date;
  reviewedAt?: Date | null;
};

export type BuildEvidenceAuditNarrativeInput = {
  claimReference: string;
  adjusterName?: string | null;
  createdAt: Date;
  approvedAt?: Date | null;
  auction?: AuctionSnapshot | null;
  winnerName?: string | null;
  bids: BidSnapshot[];
  payments: PaymentSnapshot[];
  documents: DocumentSnapshot[];
  pickupEvidence: PickupEvidenceSnapshot[];
};

function formatMoney(value: string | number): string {
  const amount = Number(value ?? 0);
  return `NGN ${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(
    Number.isFinite(amount) ? amount : 0
  )}`;
}

function formatDocumentLabel(document: DocumentSnapshot): string {
  return document.title?.trim() || document.documentType.replace(/_/g, ' ');
}

function pushEvent(events: EvidenceNarrativeEvent[], at: Date, description: string) {
  events.push({ at, description });
}

function narrateBids(bids: BidSnapshot[]): EvidenceNarrativeEvent[] {
  const events: EvidenceNarrativeEvent[] = [];
  const chronological = [...bids].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let leadingVendor: string | null = null;
  let leadingAmount = 0;

  for (const bid of chronological) {
    const vendor = bid.vendorName;
    const amount = Number(bid.amount);
    const safeAmount = Number.isFinite(amount) ? amount : 0;

    if (!leadingVendor) {
      pushEvent(
        events,
        bid.createdAt,
        `${vendor} placed the opening bid of ${formatMoney(bid.amount)}.`
      );
      leadingVendor = vendor;
      leadingAmount = safeAmount;
      continue;
    }

    if (safeAmount > leadingAmount) {
      pushEvent(
        events,
        bid.createdAt,
        `${vendor} outbid ${leadingVendor} with ${formatMoney(bid.amount)}.`
      );
      leadingVendor = vendor;
      leadingAmount = safeAmount;
      continue;
    }

    pushEvent(events, bid.createdAt, `${vendor} placed a bid of ${formatMoney(bid.amount)}.`);
  }

  return events;
}

export function buildCaseEvidenceAuditNarrative(input: BuildEvidenceAuditNarrativeInput): EvidenceNarrativeEvent[] {
  const events: EvidenceNarrativeEvent[] = [];

  pushEvent(
    events,
    input.createdAt,
    `Claim ${input.claimReference} was submitted by ${input.adjusterName?.trim() || 'the adjuster'}.`
  );

  if (input.approvedAt) {
    pushEvent(events, input.approvedAt, 'The salvage manager approved the case for auction.');
  }

  const auction = input.auction;
  if (auction?.startTime) {
    pushEvent(events, auction.startTime, 'The auction started.');
  }

  events.push(...narrateBids(input.bids));

  if (auction?.endTime) {
    const winner = input.winnerName?.trim() || 'the winning vendor';
    const closingAmount = auction.currentBid ?? input.bids[0]?.amount ?? 0;
    pushEvent(
      events,
      auction.endTime,
      `The auction closed. ${winner} won with ${formatMoney(closingAmount)}.`
    );
  }

  const signedDocuments = [...input.documents]
    .filter((document) => document.signedAt || document.status === 'signed')
    .sort((a, b) => {
      const aTime = a.signedAt?.getTime() ?? a.createdAt.getTime();
      const bTime = b.signedAt?.getTime() ?? b.createdAt.getTime();
      return aTime - bTime;
    });

  for (const document of signedDocuments) {
    const at = document.signedAt ?? document.createdAt;
    pushEvent(
      events,
      at,
      `${document.vendorName} signed the ${formatDocumentLabel(document)}.`
    );
  }

  const verifiedPayments = [...input.payments]
    .filter((payment) => payment.status === 'verified' || payment.verifiedAt)
    .sort((a, b) => {
      const aTime = a.verifiedAt?.getTime() ?? a.createdAt.getTime();
      const bTime = b.verifiedAt?.getTime() ?? b.createdAt.getTime();
      return aTime - bTime;
    });

  for (const payment of verifiedPayments) {
    const at = payment.verifiedAt ?? payment.createdAt;
    pushEvent(
      events,
      at,
      `${payment.vendorName} completed payment of ${formatMoney(payment.amount)}.`
    );
  }

  if (auction?.pickupConfirmedVendorAt || auction?.pickupConfirmedVendor) {
    const evidence = input.pickupEvidence[0];
    const at = auction.pickupConfirmedVendorAt ?? evidence?.createdAt ?? auction.endTime ?? input.createdAt;
    const vendor = evidence?.vendorName || input.winnerName || 'The winning vendor';
    pushEvent(events, at, `${vendor} submitted pickup evidence.`);
  }

  if (auction?.pickupConfirmedAdminAt || auction?.pickupConfirmedAdmin) {
    const at = auction.pickupConfirmedAdminAt ?? input.createdAt;
    pushEvent(events, at, 'Staff confirmed pickup and released the asset.');
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}
