import { authClient } from '@/data/auth-client';

/**
 * Better Auth session (`{ data, isPending, error, refetch }`); `data` is null when signed out.
 * Sign in / up / out with `signIn`, `signUp` from `@/data/auth-client` and `signOutAndForget`
 * from `@/data/account`.
 */
export function useSession() {
  return authClient.useSession();
}
