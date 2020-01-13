import {RunnableHook, Runner} from './runner';

export type OnResult<TResult> = (result: TResult) => void;

export interface RunningHook {
  readonly promise: Promise<void>;

  stop(): void;
}

export function run<TResult>(
  mainHook: RunnableHook<TResult>,
  onResult: OnResult<TResult>
): RunningHook {
  let resolvePromise: () => void;
  let rejectPromise: (error: Error) => void;

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const runner = new Runner(mainHook, {
    onResult,
    onStopped: error => {
      if (error) {
        rejectPromise(error);
      } else {
        resolvePromise();
      }
    }
  });

  runner.scheduleRun();

  return {promise, stop: () => runner.stop()};
}
