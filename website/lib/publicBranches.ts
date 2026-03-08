export type PublicBranch = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  locator: string | null;
  cellphone_no: string | null;
};

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000/api";

type PublicBranchesResponse = {
  data?: PublicBranch[];
};

export async function getPublicBranches(): Promise<PublicBranch[]> {
  try {
    const res = await fetch(`${BACKEND_API_BASE_URL}/public/branches`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return [];
    }
    const payload = (await res.json()) as PublicBranchesResponse;
    if (!Array.isArray(payload.data)) {
      return [];
    }
    return payload.data;
  } catch {
    return [];
  }
}
