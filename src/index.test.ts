import {
  Reducer,
  Subject,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState
} from '.';

interface ObserverMock {
  readonly next: jest.Mock;
  readonly error: jest.Mock;
  readonly complete: jest.Mock;
}

function createObserver(): ObserverMock {
  return {next: jest.fn(), error: jest.fn(), complete: jest.fn()};
}

function assertObserverCalls(
  observer: ObserverMock,
  nextCalls: unknown[][],
  errorCalls: unknown[][],
  completeCalls: unknown[][]
): void {
  expect(observer.next.mock.calls).toEqual(nextCalls);
  expect(observer.error.mock.calls).toEqual(errorCalls);
  expect(observer.complete.mock.calls).toEqual(completeCalls);
}

function queueMicrotask(): Promise<void> {
  return Promise.resolve().then();
}

describe('Subject', () => {
  const reducer: Reducer<number, number> = (state, action) => state + action;
  const customError = new Error('Oops!');

  let consoleError: jest.SpyInstance;
  let observer: ObserverMock;

  beforeAll(() => {
    jest.setTimeout(50);
  });

  afterAll(() => {
    jest.setTimeout(5000);
  });

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error');
    observer = createObserver();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('asynchronous initial error', async () => {
    const mainHook = jest.fn(() => {
      throw customError;
    });

    const subject = new Subject(mainHook);

    const observer1 = createObserver();
    const observer2 = createObserver();
    const observer3 = createObserver();
    const observer4 = createObserver();

    await queueMicrotask();

    expect(mainHook).toBeCalledTimes(0);

    subject.subscribe(observer1);
    subject.subscribe(observer2)();
    subject.subscribe(observer3);

    await queueMicrotask();

    expect(mainHook).toBeCalledTimes(1);

    subject.subscribe(observer4);

    await queueMicrotask();

    expect(mainHook).toBeCalledTimes(1);

    assertObserverCalls(observer1, [], [[customError]], []);
    assertObserverCalls(observer2, [], [], []);
    assertObserverCalls(observer3, [], [[customError]], []);
    assertObserverCalls(observer4, [], [], []);
  });

  test('asynchronous completion', async () => {
    const cleanUpEffect = jest.fn();

    const mainHook = jest.fn(() => {
      const [state, setState] = useState(0);

      useEffect(() => {
        if (state < 3) {
          queueMicrotask().then(() => {
            setState(previousState => previousState + 1);
            setState(previousState => previousState + 1);
          });
        }

        return cleanUpEffect;
      });

      return state;
    });

    const subject = new Subject(mainHook);

    const observer1 = createObserver();
    const observer2 = createObserver();
    const observer3 = createObserver();
    const observer4 = createObserver();
    const observer5 = createObserver();

    await queueMicrotask();

    expect(mainHook).toBeCalledTimes(0);

    subject.subscribe(observer1);

    const unsubscribe2 = subject.subscribe(observer2);

    unsubscribe2();

    const unsubscribe3 = subject.subscribe(observer3);

    await queueMicrotask();

    expect(mainHook).toBeCalledTimes(1);

    subject.subscribe(observer4);

    await queueMicrotask();

    unsubscribe3();

    subject.complete();
    subject.complete();

    expect(mainHook).toBeCalledTimes(2);

    subject.subscribe(observer5);

    await queueMicrotask();

    expect(mainHook).toBeCalledTimes(2);
    expect(cleanUpEffect).toBeCalledTimes(2);

    assertObserverCalls(observer1, [[0], [2]], [], [[]]);
    assertObserverCalls(observer2, [], [], []);
    assertObserverCalls(observer3, [[0], [2]], [], []);
    assertObserverCalls(observer4, [[2]], [], [[]]);
    assertObserverCalls(observer5, [], [], []);
  });

  test('synchronous completion', async () => {
    const mainHook = jest.fn();
    const subject = new Subject(mainHook);
    const observer = createObserver();

    subject.subscribe(observer);

    subject.complete();
    subject.complete();

    await queueMicrotask();

    expect(mainHook).toBeCalledTimes(0);

    assertObserverCalls(observer, [], [], [[]]);
  });

  test('sequence of setState, effect, and cleanUpEffect', async () => {
    const log = jest.fn();

    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      log('mainHook', state);

      useEffect(() => {
        log('effect1', state);

        if (state === 1) {
          log('setState', 2);
          setState(2);
        }

        return () => log('cleanup1');
      });

      useEffect(() => {
        log('one-time effect2', state);

        return () => log('cleanup2');
      }, []);

      useEffect(() => {
        if (state === 4) {
          log('failing effect3', state);

          throw customError;
        } else {
          log('effect3', state);
        }

        return () => log('cleanup3');
      });

      useEffect(() => {
        log('effect4', state);

        return () => log('cleanup4');
      });

      if (state < 1) {
        log('setState', 1);
        setState(1);
      }

      if (state === 2) {
        log('setState', 3);
        setState(3);

        log('setState', 4);
        setState(previousState => previousState + 1);
      }

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    expect(log.mock.calls).toEqual([
      ['mainHook', 0],
      ['setState', 1],
      ['mainHook', 1],
      ['effect1', 1],
      ['setState', 2],
      ['one-time effect2', 1],
      ['effect3', 1],
      ['effect4', 1],
      ['mainHook', 2],
      ['setState', 3],
      ['setState', 4],
      ['mainHook', 4],
      ['cleanup1'],
      ['cleanup3'],
      ['cleanup4'],
      ['effect1', 4],
      ['failing effect3', 4],
      ['cleanup1'],
      ['cleanup2']
    ]);

    assertObserverCalls(observer, [[0], [1], [2], [4]], [[customError]], []);
  });

  test('error if the number of hook calls is changed (1)', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn());
        setState(1);
      }

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    const expectedError = new Error(
      'The number of hook calls must not change.'
    );

    assertObserverCalls(observer, [[0]], [[expectedError]], []);
  });

  test('error if the number of hook calls is changed (2)', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        setState(1);
      } else {
        useEffect(jest.fn());
      }

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    const expectedError = new Error(
      'The number of hook calls must not change.'
    );

    assertObserverCalls(observer, [[0]], [[expectedError]], []);
  });

  test('error if the order of hook calls is changed', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn());
        setState(1);
      } else {
        useState(NaN);
      }

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    const expectedError = new Error('The order of hook calls must not change.');

    assertObserverCalls(observer, [[0]], [[expectedError]], []);
  });

  test('error if an effect hook is called outside the body of the main hook', async () => {
    const subject = new Subject(() => {
      useEffect(() => {
        useEffect(jest.fn());
      });

      return 0;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    const expectedError = new Error(
      'Hooks can only be called inside the body of the main hook.'
    );

    assertObserverCalls(observer, [[0]], [[expectedError]], []);
  });

  test('error if a state hook is called outside the body of the main hook', async () => {
    const subject = new Subject(() => {
      useEffect(() => {
        useState(NaN);
      });

      return 0;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    const expectedError = new Error(
      'Hooks can only be called inside the body of the main hook.'
    );

    assertObserverCalls(observer, [[0]], [[expectedError]], []);
  });

  test('error if the existence of hook dependencies is changed (1)', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn(), []);
        setState(1);
      } else {
        useEffect(jest.fn());
      }

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    const expectedError = new Error(
      'The existence of hook dependencies must not change.'
    );

    assertObserverCalls(observer, [[0]], [[expectedError]], []);
  });

  test('error if the existence of hook dependencies is changed (2)', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn());
        setState(1);
      } else {
        useEffect(jest.fn(), []);
      }

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    const expectedError = new Error(
      'The existence of hook dependencies must not change.'
    );

    assertObserverCalls(observer, [[0]], [[expectedError]], []);
  });

  test('error if the number of hook dependencies is changed (1)', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn(), [0]);
        setState(1);
      } else {
        useEffect(jest.fn(), []);
      }

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    const expectedError = new Error(
      'The order and number of hook dependencies must not change.'
    );

    assertObserverCalls(observer, [[0]], [[expectedError]], []);
  });

  test('error if the number of hook dependencies is changed (2)', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn(), []);
        setState(1);
      } else {
        useEffect(jest.fn(), [0]);
      }

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    const expectedError = new Error(
      'The order and number of hook dependencies must not change.'
    );

    assertObserverCalls(observer, [[0]], [[expectedError]], []);
  });

  test('undefined value', async () => {
    const subject = new Subject(() => undefined);

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[undefined]], [], []);
  });

  test('null value', async () => {
    const subject = new Subject(() => null);

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[null]], [], []);
  });

  test('lazy initial state', async () => {
    const createInitialState = jest.fn(() => 0);

    const subject = new Subject(() => {
      const [state, setState] = useState(createInitialState);

      if (state === 0) {
        setState(1);
      }

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    expect(createInitialState).toHaveBeenCalledTimes(1);

    assertObserverCalls(observer, [[0], [1]], [], []);
  });

  test('failing createInitialState', async () => {
    const subject = new Subject(() => {
      useState(() => {
        throw customError;
      });

      return 0;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [], [[customError]], []);
  });

  test('failing createState', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      setState(() => {
        throw customError;
      });

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[0]], [[customError]], []);
  });

  test('failing effect', async () => {
    const subject = new Subject(() => {
      useEffect(() => {
        throw customError;
      });

      return 0;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[0]], [[customError]], []);
  });

  test('failing cleanUpEffect', async () => {
    const cleanUpEffect = jest.fn();

    const subject = new Subject(() => {
      useEffect(() => () => {
        throw customError;
      });

      useEffect(() => cleanUpEffect);

      return 0;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    subject.complete();

    expect(cleanUpEffect).toHaveBeenCalledTimes(1);

    expect(consoleError.mock.calls).toEqual([
      ['Error while cleaning up effect.', customError]
    ]);

    assertObserverCalls(observer, [[0]], [], [[]]);
  });

  test('failing observer.next', async () => {
    const subject = new Subject(() => 0);

    const observer1 = createObserver();
    const observer2 = createObserver();

    observer1.next.mockImplementation(() => {
      throw customError;
    });

    subject.subscribe(observer1);
    subject.subscribe(observer2);

    await queueMicrotask();

    expect(consoleError.mock.calls).toEqual([
      ['Error while publishing value.', customError]
    ]);

    assertObserverCalls(observer1, [[0]], [], []);
    assertObserverCalls(observer2, [[0]], [], []);
  });

  test('failing observer.error', async () => {
    const customError1 = new Error('Oops1!');
    const customError2 = new Error('Oops2!');

    const subject = new Subject(() => {
      throw customError1;
    });

    const observer1 = createObserver();
    const observer2 = createObserver();

    observer1.error.mockImplementation(() => {
      throw customError2;
    });

    subject.subscribe(observer1);
    subject.subscribe(observer2);

    await queueMicrotask();

    expect(consoleError.mock.calls).toEqual([
      ['Error while publishing error.', customError2]
    ]);

    assertObserverCalls(observer1, [], [[customError1]], []);
    assertObserverCalls(observer2, [], [[customError1]], []);
  });

  test('failing observer.complete', async () => {
    const subject = new Subject(jest.fn());

    const observer1 = createObserver();
    const observer2 = createObserver();

    observer1.complete.mockImplementation(() => {
      throw customError;
    });

    subject.subscribe(observer1);
    subject.subscribe(observer2);

    subject.complete();

    expect(consoleError.mock.calls).toEqual([
      ['Error while completing.', customError]
    ]);

    assertObserverCalls(observer1, [], [], [[]]);
    assertObserverCalls(observer2, [], [], [[]]);
  });

  test('different hook inputs', async () => {
    const effect1 = jest.fn();
    const effect2 = jest.fn();
    const effect3 = jest.fn();

    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      useEffect(() => {
        if (state < 2) {
          setState(previousState => previousState + 1);
        }
      });

      useEffect(effect1, []);
      useEffect(effect2, state === 0 ? ['a', 'b', 'c'] : ['a', 'c', 'b']);
      useEffect(effect3);

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenCalledTimes(2);
    expect(effect3).toHaveBeenCalledTimes(3);

    assertObserverCalls(observer, [[0], [1], [2]], [], []);
  });

  test('no state change', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      setState(0);

      useEffect(() => {
        setState(0);
        setState(0);
      });

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[0]], [], []);
  });

  test('state changes', async () => {
    const subject = new Subject(() => {
      const [state1, setState1] = useState('a');
      const [state2, setState2] = useState('x');

      if (state1 === 'a') {
        setState1('b');
      }

      if (state1 === 'b') {
        setState2('y');
      }

      if (state2 === 'y') {
        setState1('c');
      }

      return state1 + state2;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [['ax'], ['bx'], ['by'], ['cy']], [], []);
  });

  test('parallel subjects', async () => {
    const subject1 = new Subject(() => {
      const [state, setState] = useState(0);

      useEffect(() => {
        setState(previousState => previousState + 1);
      }, []);

      return state;
    });

    const subject2 = new Subject(() => {
      throw customError;
    });

    const subject3 = new Subject(() => {
      const [state, setState] = useState(100);

      useEffect(() => {
        setState(previousState => previousState - 1);
      }, []);

      return state;
    });

    subject1.subscribe(observer);
    subject2.subscribe(observer);
    subject3.subscribe(observer);

    await queueMicrotask();

    subject1.complete();
    subject3.complete();

    assertObserverCalls(
      observer,
      [[0], [1], [100], [99]],
      [[customError]],
      [[], []]
    );
  });

  test('stable setState identity', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      useEffect(() => {
        setState(previousState => previousState + 1);
      }, [setState]);

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[0], [1]], [], []);
  });

  test('different callback inputs', async () => {
    const effect1 = jest.fn();
    const effect2 = jest.fn();
    const effect3 = jest.fn();

    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      useEffect(() => {
        if (state < 2) {
          setState(previousState => previousState + 1);
        }
      });

      const callback1 = useCallback(jest.fn(), []);

      const callback2 = useCallback(
        jest.fn(),
        state === 0 ? ['a', 'b', 'c'] : ['a', 'c', 'b']
      );

      const callback3 = useCallback(jest.fn(), [state]);

      useEffect(effect1, [callback1]);
      useEffect(effect2, [callback2]);
      useEffect(effect3, [callback3]);

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenCalledTimes(2);
    expect(effect3).toHaveBeenCalledTimes(3);

    assertObserverCalls(observer, [[0], [1], [2]], [], []);
  });

  test('callback identity', async () => {
    const callback = jest.fn();
    const subject = new Subject(() => useCallback(callback, []));

    subject.subscribe(observer);

    await queueMicrotask();

    expect(callback).toHaveBeenCalledTimes(0);

    assertObserverCalls(observer, [[callback]], [], []);
  });

  test('ref-object persistence', async () => {
    const subject = new Subject(() => {
      const [state, setState] = useState(0);

      useEffect(() => setState(1), []);

      const refObject = useRef(state);

      refObject.current += 1;

      return refObject.current;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[1], [2]], [], []);
  });

  test('reducer with static initial state', async () => {
    const subject = new Subject(() => {
      const [state, dispatch] = useReducer(reducer, 22);

      useEffect(() => {
        dispatch(-2);
        dispatch(10);
      }, []);

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[22], [30]], [], []);
  });

  test('reducer with lazy initial state', async () => {
    const subject = new Subject(() => {
      const [state, dispatch] = useReducer(
        reducer,
        '44',
        initialArg => parseInt(initialArg, 10) - 22
      );

      useEffect(() => {
        dispatch(-2);
        dispatch(10);
      }, []);

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[22], [30]], [], []);
  });

  test('failing reducer function', async () => {
    const subject = new Subject(() => {
      const [state, dispatch] = useReducer(() => {
        throw customError;
      }, 0);

      dispatch(1);

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[0]], [[customError]], []);
  });

  test('stable dispatch identity', async () => {
    const subject = new Subject(() => {
      const [state, dispatch] = useReducer(reducer, 0);

      useEffect(() => {
        dispatch(1);
      }, [dispatch]);

      return state;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    assertObserverCalls(observer, [[0], [1]], [], []);
  });

  test('illegal hook calls', () => {
    const subject = new Subject(jest.fn());

    expect(() => subject.useEffect(jest.fn())).toThrowError(
      'Please use the separately exported useEffect() function.'
    );

    expect(() => subject.useState(0)).toThrowError(
      'Please use the separately exported useState() function.'
    );

    expect(() => subject.useMemo(jest.fn(), [])).toThrowError(
      'Please use the separately exported useMemo() function.'
    );
  });

  test('clean up effects before calling observer.error', async () => {
    const cleanUpEffect = jest.fn();

    const mainHook = jest.fn(() => {
      useEffect(() => cleanUpEffect);

      useEffect(() => {
        throw customError;
      });
    });

    const subject = new Subject(mainHook);
    const observer = createObserver();

    let numberOfCalls = 0;

    observer.error.mockImplementation(() => {
      numberOfCalls = cleanUpEffect.mock.calls.length;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    expect(numberOfCalls).toBe(1);

    assertObserverCalls(observer, [[undefined]], [[customError]], []);
  });

  test('clean up effects before calling observer.complete', async () => {
    const cleanUpEffect = jest.fn();

    const mainHook = jest.fn(() => {
      useEffect(() => cleanUpEffect);
    });

    const subject = new Subject(mainHook);
    const observer = createObserver();

    let numberOfCalls = 0;

    observer.complete.mockImplementation(() => {
      numberOfCalls = cleanUpEffect.mock.calls.length;
    });

    subject.subscribe(observer);

    await queueMicrotask();

    subject.complete();

    expect(numberOfCalls).toBe(1);

    assertObserverCalls(observer, [[undefined]], [], [[]]);
  });
});
