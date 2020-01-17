import {Effect, Runner} from './runner';

export function useEffect(effect: Effect, dependencies?: unknown[]): void {
  Runner.getActive().useEffect(effect, dependencies);
}
