export type PublicReview = {
  id: number;
  customer_name: string;
  customer_handle: string | null;
  rating: number;
  title: string | null;
  comment: string;
  is_verified_purchase: boolean;
  created_at: string | null;
  product: {
    id: number;
    name: string;
  } | null;
  variant: {
    id: number;
    variant_name: string | null;
    flavor: string | null;
    sku: string;
  } | null;
};

export type SubmitPublicReviewInput = {
  customerName: string;
  customerHandle?: string | null;
  rating: number;
  title?: string | null;
  comment: string;
  productVariantId?: number | null;
};

type PublicReviewsListResponse = {
  data?: PublicReview[];
};

type PublicReviewItemResponse = {
  message?: string;
  data?: PublicReview;
};

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000/api";

function isPublicReview(value: unknown): value is PublicReview {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<PublicReview>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.customer_name === "string" &&
    typeof candidate.rating === "number" &&
    typeof candidate.comment === "string"
  );
}

function parseErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const message = record.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  return null;
}

export async function getPublicReviews(limit = 12): Promise<PublicReview[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 100));
  try {
    const res = await fetch(`${BACKEND_API_BASE_URL}/public/reviews?limit=${normalizedLimit}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return [];
    }

    const payload = (await res.json()) as PublicReviewsListResponse;
    const items = payload.data ?? [];
    return items.filter(isPublicReview);
  } catch {
    return [];
  }
}

export async function submitPublicReview(input: SubmitPublicReviewInput): Promise<PublicReview> {
  const body = {
    customer_name: input.customerName,
    customer_handle: input.customerHandle ?? null,
    rating: input.rating,
    title: input.title ?? null,
    comment: input.comment,
    product_variant_id: input.productVariantId ?? null,
  };

  const res = await fetch(`${BACKEND_API_BASE_URL}/public/reviews`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => null)) as PublicReviewItemResponse | null;

  if (!res.ok) {
    const message = parseErrorMessage(payload) ?? "Unable to submit review right now.";
    throw new Error(message);
  }

  if (!payload?.data || !isPublicReview(payload.data)) {
    throw new Error("Review submission succeeded but returned invalid data.");
  }

  return payload.data;
}

