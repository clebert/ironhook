import {Effect, Runner} from './runner';

export function useEffect(effect: Effect, dependencies?: unknown[]): void {
  Runner.getCurrent().useEffect(effect, dependencies);
}
