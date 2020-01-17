import {Runner} from './runner';

export function useMemo<TValue>(
  createValue: () => TValue,
  dependencies: unknown[]
): TValue {
  return Runner.getActive().useMemo(createValue, dependencies);
}
