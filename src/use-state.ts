import {CreateInitialState, Runner, SetState} from './runner';

export function useState<TState>(
  initialState: TState | CreateInitialState<TState>
): [TState, SetState<TState>] {
  return Runner.getActive().useState(initialState);
}
