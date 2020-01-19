import {areHookInputsEqual} from './utils/are-hook-inputs-equal';
import {isFunction} from './utils/is-function';
import {isKindOf} from './utils/is-kind-of';

export interface Observer<TValue> {
  next(value: TValue): void;
  error(error: Error): void;
  complete(): void;
}

export type Unsubscribe = () => void;
export type MainHook<TValue> = () => TValue;
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

export class Subject<TValue> {
  private static active: Subject<unknown> | undefined;

  public static getActive(): Subject<unknown> {
    if (!Subject.active) {
      throw new Error(
        'Hooks can only be called inside the body of the main hook.'
      );
    }

    return Subject.active;
  }

  private readonly memory: MemoryCell[] = [];

  private observers: Set<Observer<TValue>> | undefined = new Set<
    Observer<TValue>
  >();

  /**
   * This promise is resolved both in the case of an error
   * and after normal completion.
   */
  public readonly completion: Promise<void>;

  private resolveCompletion!: () => void;
  private memoryAllocated = false;
  private memoryPointer = 0;

  public constructor(private readonly mainHook: MainHook<TValue>) {
    this.completion = new Promise<void>(
      resolve => (this.resolveCompletion = resolve)
    );
  }

  public subscribe(observer: Observer<TValue>): Unsubscribe {
    this.observers?.add(observer);

    this.run();

    return () => this.observers?.delete(observer);
  }

  public complete(): void {
    const observers = this.observers;

    if (!observers) {
      return;
    }

    for (const observer of observers) {
      try {
        observer.complete();
      } catch (error) {
        console.error('Error while completion.', error);
      }
    }

    this.observers = undefined;

    this.cleanUpEffects(true);
    this.resolveCompletion();
  }

  public useEffect(effect: Effect, dependencies?: unknown[]): void {
    if (this !== Subject.active) {
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
    if (this !== Subject.active) {
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

          this.run();
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
    if (this !== Subject.active) {
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

  private run(): void {
    Promise.resolve().then(() => {
      try {
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
      } catch (error) {
        const observers = this.observers;

        if (!observers) {
          return;
        }

        for (const observer of observers) {
          try {
            observer.error(error);
          } catch (error) {
            console.error('Error while publishing error.', error);
          }
        }

        this.observers = undefined;

        this.cleanUpEffects(true);
        this.resolveCompletion();
      }
    });
  }

  private execute(): void {
    if (!this.observers) {
      return;
    }

    Subject.active = this;

    try {
      this.memoryPointer = 0;

      const value = this.mainHook();

      if (this.memoryPointer !== this.memory.length) {
        throw new Error('The number of hook calls must not change.');
      }

      this.memoryAllocated = true;

      for (const observer of this.observers) {
        try {
          observer.next(value);
        } catch (error) {
          console.error('Error while publishing value.', error);
        }
      }
    } finally {
      Subject.active = undefined;
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
