import {Effect, Subject} from '../subject';

export function useEffect(effect: Effect, dependencies?: unknown[]): void {
  Subject.getActive().useEffect(effect, dependencies);
}
