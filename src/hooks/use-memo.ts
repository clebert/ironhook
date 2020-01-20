import {Subject} from '../subject';

export function useMemo<TValue>(
  createValue: () => TValue,
  dependencies: unknown[]
): TValue {
  return Subject.getActive().useMemo(createValue, dependencies);
}
