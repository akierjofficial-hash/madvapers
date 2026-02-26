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

const fallbackBranches: PublicBranch[] = [
  {
    id: 1,
    code: "BAGACAY",
    name: "Bagacay Branch (Main Branch)",
    address: "National Highway, Bagacay, Dumaguete City",
    locator: "Bagacay, Dumaguete City",
    cellphone_no: "+63 900 111 1001",
  },
  {
    id: 2,
    code: "MOTONG",
    name: "Motong Branch",
    address: "Motong Area, Dumaguete City",
    locator: "Motong, Dumaguete City",
    cellphone_no: "+63 900 111 1002",
  },
  {
    id: 3,
    code: "HAYAHAY",
    name: "Hayahay Branch",
    address: "Hayahay Area, Dumaguete City",
    locator: "Hayahay, Dumaguete City",
    cellphone_no: "+63 900 111 1003",
  },
];

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
      return fallbackBranches;
    }
    const payload = (await res.json()) as PublicBranchesResponse;
    if (!Array.isArray(payload.data)) {
      return fallbackBranches;
    }
    return payload.data;
  } catch {
    return fallbackBranches;
  }
}

