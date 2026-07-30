import { CHAIN_ENDPOINTS } from "@/services/walletConstants";

const PROTON_IDENTITY_CONTRACT = "eosio.proton";

type UsersInfoRow = {
  acc?: string;
  verified?: boolean | number;
};

/** `usersinfo.verified` on-chain is bool 0/1 (RPC may return number or boolean). */
export function parseProtonUsersInfoVerified(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return false;
}

/** Read WebAuth identity verification from `eosio.proton::usersinfo` (not invite.mon3y). */
export async function fetchProtonUserVerified(
  account: string,
): Promise<boolean> {
  const acct = account.trim().toLowerCase();
  let lastError: Error | null = null;

  for (const endpoint of CHAIN_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: PROTON_IDENTITY_CONTRACT,
          scope: PROTON_IDENTITY_CONTRACT,
          table: "usersinfo",
          lower_bound: acct,
          upper_bound: acct,
          limit: 1,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        rows?: UsersInfoRow[];
        message?: string;
      };
      if (!res.ok)
        throw new Error(
          data.message || `usersinfo read failed (${res.status})`,
        );

      const row = data.rows?.[0];
      if (!row || String(row.acc ?? "").toLowerCase() !== acct) return false;
      return parseProtonUsersInfoVerified(row.verified);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Unable to read eosio.proton usersinfo.");
}

export async function fetchProtonUsersVerified(
  accounts: string[],
): Promise<Map<string, boolean>> {
  const unique = [
    ...new Set(accounts.map((a) => a.trim().toLowerCase()).filter(Boolean)),
  ];
  const entries = await Promise.all(
    unique.map(
      async (account) =>
        [account, await fetchProtonUserVerified(account)] as const,
    ),
  );
  return new Map(entries);
}
