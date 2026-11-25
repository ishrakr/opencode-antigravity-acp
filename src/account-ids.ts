// Provider IDs of the Antigravity accounts. No Node imports: browser bundles use it too.

/** The provider of your normal `agy` login in `~/.gemini`. */
export const MAIN_PROVIDER_ID = "antigravity-acp"
export const MAIN_ACCOUNT_ID = "main"
export const ACCOUNT_PROVIDER_PREFIX = `${MAIN_PROVIDER_ID}-`

/** True for the main provider and every account's provider. */
export function isAntigravityProvider(providerID: unknown): providerID is string {
  return (
    typeof providerID === "string" &&
    (providerID === MAIN_PROVIDER_ID || providerID.startsWith(ACCOUNT_PROVIDER_PREFIX))
  )
}

export function accountProviderID(accountId: string): string {
  return accountId === MAIN_ACCOUNT_ID ? MAIN_PROVIDER_ID : `${ACCOUNT_PROVIDER_PREFIX}${accountId}`
}

/** The account a provider belongs to: "main", an account ID, or null for other providers. */
export function accountIdOfProvider(providerID: unknown): string | null {
  if (providerID === MAIN_PROVIDER_ID) return MAIN_ACCOUNT_ID
  if (typeof providerID === "string" && providerID.startsWith(ACCOUNT_PROVIDER_PREFIX)) {
    return providerID.slice(ACCOUNT_PROVIDER_PREFIX.length) || null
  }
  return null
}
