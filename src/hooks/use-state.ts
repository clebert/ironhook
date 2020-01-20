import {CreateInitialState, SetState, Subject} from '../subject';

export function useState<TState>(
  initialState: TState | CreateInitialState<TState>
): [TState, SetState<TState>] {
  return Subject.getActive().useState(initialState);
}
