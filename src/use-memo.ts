import {Runner} from './runner';

export function useMemo<TValue>(
  createValue: () => TValue,
  dependencies: unknown[]
): TValue {
  return Runner.getCurrent().useMemo(createValue, dependencies);
}
