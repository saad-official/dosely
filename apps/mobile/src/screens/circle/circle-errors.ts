import { ApiError } from '@/data';

/** Plain-language message for a circle / account API failure. */
export function circleErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return "Can't reach Dosely right now. Check your connection and try again.";
    switch (error.code) {
      case 'circle_not_found':
        return 'No circle uses that code. Check it with the person who shared it.';
      case 'own_circle':
        return "That's your own circle's code. Share it with your caregiver instead.";
      case 'circle_full':
        return 'That circle is full. Ask its owner to remove someone first.';
    }
    if (error.status === 401) return 'Please sign in again.';
    return error.message || 'Something went wrong. Please try again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
