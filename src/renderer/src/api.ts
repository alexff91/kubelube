import type { ApiResult } from '@shared/types';

export const kube = window.kubelube;

/** Converts an ApiResult into resolved data or a thrown Error. */
export async function unwrap<T>(promise: Promise<ApiResult<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
