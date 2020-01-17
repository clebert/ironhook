import {areHookInputsEqual} from './utils/are-hook-inputs-equal';
import {isFunction} from './utils/is-function';
import {isKindOf} from './utils/is-kind-of';
import {queueMacrotask} from './utils/queue-macrotask';

export type RunnableHook<TResult> = () => TResult | undefined;

export interface Listener<TResult> {
  onResult(result: TResult): void;
  onStopped(error?: Error): void;
}

export type CleanUpEffect = () => void;
export type Effect = () => CleanUpEffect | void;
export type CreateInitialState<TState> = () => TState;
export type CreateState<TState> = (previousState: TState) => TState;
export type SetState<TState> = (state: TState | CreateState<TState>) => void;

interface EffectMemoryCell {
  readonly kind: 'EffectMemoryCell';

  outdated: boolean;
  effect: Effect;
  dependencies: unknown[] | undefined;
  cleanUpEffect?: CleanUpEffect;
}

interface StateMemoryCell<TState> {
  readonly kind: 'StateMemoryCell';
  readonly setState: SetState<TState>;

  state: TState;
  stateChanges: (TState | CreateState<TState>)[];
}

interface MemoMemoryCell<TValue> {
  readonly kind: 'MemoMemoryCell';

  value: TValue;
  dependencies: unknown[];
}

type MemoryCell = EffectMemoryCell | StateMemoryCell<any> | MemoMemoryCell<any>;

export class Runner<TResult> {
  private static active: Runner<unknown> | undefined;

  public static getActive(): Runner<unknown> {
    if (!Runner.active) {
      throw new Error(
        'Hooks can only be called inside the body of a parent hook.'
      );
    }

    return Runner.active;
  }

  private readonly memory: MemoryCell[] = [];

  private memoryAllocated = false;
  private memoryPointer = 0;
  private stopped = false;
  private running = false;

  public constructor(
    private readonly mainHook: RunnableHook<TResult>,
    private readonly listener: Listener<TResult>
  ) {}

  public useEffect(effect: Effect, dependencies: unknown[] | undefined): void {
    /* istanbul ignore next */
    if (this !== Runner.active) {
      throw new Error(
        'Please use the separately exported useEffect() function.'
      );
    }

    const memoryCell = this.getMemoryCell<EffectMemoryCell>('EffectMemoryCell');

    if (!memoryCell) {
      this.memory[this.memoryPointer] = {
        kind: 'EffectMemoryCell',
        outdated: true,
        effect,
        dependencies
      };
    } else if (
      !areHookInputsEqual(memoryCell.dependencies, dependencies) ||
      memoryCell.outdated
    ) {
      memoryCell.outdated = true;
      memoryCell.effect = effect;
      memoryCell.dependencies = dependencies;
    }

    this.memoryPointer += 1;
  }

  public useState<TState>(
    initialState: TState | CreateInitialState<TState>
  ): [TState, SetState<TState>] {
    /* istanbul ignore next */
    if (this !== Runner.active) {
      throw new Error(
        'Please use the separately exported useState() function.'
      );
    }

    let memoryCell = this.getMemoryCell<StateMemoryCell<TState>>(
      'StateMemoryCell'
    );

    if (!memoryCell) {
      this.memory[this.memoryPointer] = memoryCell = {
        kind: 'StateMemoryCell',
        setState: state => {
          memoryCell!.stateChanges = [...memoryCell!.stateChanges, state];
          this.scheduleRun();
        },
        state: isFunction<CreateInitialState<TState>>(initialState)
          ? initialState()
          : initialState,
        stateChanges: []
      };
    }

    this.memoryPointer += 1;

    return [memoryCell.state, memoryCell.setState];
  }

  public useMemo<TValue>(
    createValue: () => TValue,
    dependencies: unknown[]
  ): TValue {
    /* istanbul ignore next */
    if (this !== Runner.active) {
      throw new Error('Please use the separately exported useMemo() function.');
    }

    let memoryCell = this.getMemoryCell<MemoMemoryCell<TValue>>(
      'MemoMemoryCell'
    );

    if (!memoryCell) {
      this.memory[this.memoryPointer] = memoryCell = {
        kind: 'MemoMemoryCell',
        value: createValue(),
        dependencies
      };
    } else if (!areHookInputsEqual(memoryCell.dependencies, dependencies)) {
      memoryCell.value = createValue();
      memoryCell.dependencies = dependencies;
    }

    this.memoryPointer += 1;

    return memoryCell.value;
  }

  public scheduleRun(): void {
    if (this.running) {
      return;
    }

    queueMacrotask(() => {
      if (this.stopped) {
        return;
      }

      this.running = true;
      this.run();
      this.running = false;
    }).catch(error => this.stop(error));
  }

  public stop(error?: Error): void {
    if (this.stopped) {
      return;
    }

    this.stopped = true;

    Promise.resolve()
      .then(() => {
        this.cleanUpEffects(true);
        this.listener.onStopped(error);
      })
      .catch(error =>
        /* istanbul ignore next */
        console.error('Error while stopping runner.', error)
      );
  }

  private run(): void {
    if (!this.memoryAllocated || this.applyStateChanges()) {
      do {
        this.execute();

        while (this.applyStateChanges()) {
          this.execute();
        }

        this.cleanUpEffects();
        this.triggerEffects();
      } while (this.applyStateChanges());
    }
  }

  private execute(): void {
    Runner.active = this;

    try {
      this.memoryPointer = 0;

      const result = this.mainHook();

      if (this.memoryPointer !== this.memory.length) {
        throw new Error('The number of hook calls must not change.');
      }

      this.memoryAllocated = true;

      if (result !== undefined) {
        this.listener.onResult(result);
      }
    } finally {
      Runner.active = undefined;
    }
  }

  private cleanUpEffects(force = false): void {
    for (const memoryCell of this.memory) {
      if (isKindOf<EffectMemoryCell>('EffectMemoryCell', memoryCell)) {
        if ((memoryCell.outdated || force) && memoryCell.cleanUpEffect) {
          try {
            memoryCell.cleanUpEffect();
          } catch (error) {
            console.error('Error while cleaning up effect.', error);
          }

          memoryCell.cleanUpEffect = undefined;
        }
      }
    }
  }

  private triggerEffects(): void {
    for (const memoryCell of this.memory) {
      if (isKindOf<EffectMemoryCell>('EffectMemoryCell', memoryCell)) {
        if (memoryCell.outdated) {
          memoryCell.outdated = false;
          memoryCell.cleanUpEffect = memoryCell.effect() || undefined;
        }
      }
    }
  }

  private applyStateChanges(): boolean {
    let changed = false;

    for (const memoryCell of this.memory) {
      if (isKindOf<StateMemoryCell<unknown>>('StateMemoryCell', memoryCell)) {
        for (const stateChange of memoryCell.stateChanges) {
          const state = isFunction<CreateState<unknown>>(stateChange)
            ? stateChange(memoryCell.state)
            : stateChange;

          if (!Object.is(memoryCell.state, state)) {
            memoryCell.state = state;
            changed = true;
          }
        }

        memoryCell.stateChanges = [];
      }
    }

    return changed;
  }

  private getMemoryCell<TMemoryCell extends MemoryCell>(
    kind: TMemoryCell['kind']
  ): TMemoryCell | undefined {
    const memoryCell = this.memory[this.memoryPointer];

    if (!memoryCell && this.memoryAllocated) {
      throw new Error('The number of hook calls must not change.');
    }

    if (memoryCell && !isKindOf<TMemoryCell>(kind, memoryCell)) {
      throw new Error('The order of hook calls must not change.');
    }

    return memoryCell;
  }
}
