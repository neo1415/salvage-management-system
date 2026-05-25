type BroadcastTarget = {
  room?: string;
  userId?: string;
  vendorId?: string;
  auctionId?: string;
  allAuctions?: boolean;
};

type BroadcastPayload = {
  type: string;
  target: BroadcastTarget;
  payload?: Record<string, unknown>;
};

const DEFAULT_TIMEOUT_MS = 1500;

export async function broadcastToSocketSidecar(message: BroadcastPayload): Promise<boolean> {
  const baseUrl = process.env.SOCKET_INTERNAL_URL;
  const secret = process.env.SOCKET_INTERNAL_SECRET;

  if (!baseUrl || !secret) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(message),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[Socket Sidecar] Broadcast rejected', {
        status: response.status,
        type: message.type,
        target: Object.keys(message.target),
      });
      return false;
    }

    return true;
  } catch (error) {
    console.warn('[Socket Sidecar] Broadcast failed', {
      type: message.type,
      target: Object.keys(message.target),
      error: error instanceof Error ? error.name : 'unknown',
    });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
