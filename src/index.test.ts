import {run, useCallback, useEffect, useRef, useState} from '.';
import {queueMacrotask} from './utils/queue-macrotask';

describe('run()', () => {
  const error = new Error('Oops!');

  let onResult: jest.Mock;
  let onError: jest.Mock;
  let consoleError: jest.SpyInstance;

  beforeAll(() => {
    jest.setTimeout(50);
  });

  afterAll(() => {
    jest.setTimeout(5000);
  });

  beforeEach(() => {
    onResult = jest.fn();
    onError = jest.fn();
    consoleError = jest.spyOn(console, 'error');
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('order of setState(), effect(), cleanUpEffect()', async () => {
    const log = jest.fn();

    const runningHook = run(() => {
      const [state, setState] = useState(0);

      log('run', state);

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

          throw error;
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
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0], [1], [2], [4]]);
    expect(onError.mock.calls).toEqual([[error]]);

    expect(log.mock.calls).toEqual([
      ['run', 0],
      ['setState', 1],
      ['run', 1],
      ['effect1', 1],
      ['setState', 2],
      ['one-time effect2', 1],
      ['effect3', 1],
      ['effect4', 1],
      ['run', 2],
      ['setState', 3],
      ['setState', 4],
      ['run', 4],
      ['cleanup1'],
      ['cleanup3'],
      ['cleanup4'],
      ['effect1', 4],
      ['failing effect3', 4],
      ['cleanup1'],
      ['cleanup2']
    ]);
  });

  test('error if the number of hook calls is changed (1)', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn());
        setState(1);
      }

      return state;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);

    expect(onError.mock.calls).toEqual([
      [new Error('The number of hook calls must not change.')]
    ]);
  });

  test('error if the number of hook calls is changed (2)', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        setState(1);
      } else {
        useEffect(jest.fn());
      }

      return state;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);

    expect(onError.mock.calls).toEqual([
      [new Error('The number of hook calls must not change.')]
    ]);
  });

  test('error if the order of hook calls is changed', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn());
        setState(1);
      } else {
        useState(NaN);
      }

      return state;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);

    expect(onError.mock.calls).toEqual([
      [new Error('The order of hook calls must not change.')]
    ]);
  });

  test('error if an effect hook is called outside the body of a parent hook', async () => {
    const runningHook = run(() => {
      useEffect(() => {
        useEffect(jest.fn());
      });

      return 0;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);

    expect(onError.mock.calls).toEqual([
      [new Error('Hooks can only be called inside the body of a parent hook.')]
    ]);
  });

  test('error if a state hook is called outside the body of a parent hook', async () => {
    const runningHook = run(() => {
      useEffect(() => {
        useState(NaN);
      });

      return 0;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);

    expect(onError.mock.calls).toEqual([
      [new Error('Hooks can only be called inside the body of a parent hook.')]
    ]);
  });

  test('error if the existence of hook dependencies is changed (1)', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn(), []);
        setState(1);
      } else {
        useEffect(jest.fn());
      }

      return state;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);

    expect(onError.mock.calls).toEqual([
      [new Error('The existence of hook dependencies must not change.')]
    ]);
  });

  test('error if the existence of hook dependencies is changed (2)', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn());
        setState(1);
      } else {
        useEffect(jest.fn(), []);
      }

      return state;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);

    expect(onError.mock.calls).toEqual([
      [new Error('The existence of hook dependencies must not change.')]
    ]);
  });

  test('error if the number of hook dependencies is changed (1)', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn(), [0]);
        setState(1);
      } else {
        useEffect(jest.fn(), []);
      }

      return state;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);

    expect(onError.mock.calls).toEqual([
      [new Error('The order and number of hook dependencies must not change.')]
    ]);
  });

  test('error if the number of hook dependencies is changed (2)', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      if (state === 0) {
        useEffect(jest.fn(), []);
        setState(1);
      } else {
        useEffect(jest.fn(), [0]);
      }

      return state;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);

    expect(onError.mock.calls).toEqual([
      [new Error('The order and number of hook dependencies must not change.')]
    ]);
  });

  test('single run with result', async () => {
    const runningHook = run(() => 0, onResult);

    await queueMacrotask(() => runningHook.stop());
    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([[0]]);
  });

  test('single run without result', async () => {
    const runningHook = run(() => undefined, onResult);

    await queueMacrotask(() => runningHook.stop());
    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([]);
  });

  test('lazy initial state', async () => {
    const createInitialState = jest.fn(() => 0);

    const runningHook = run(() => {
      const [state, setState] = useState(createInitialState);

      if (state === 0) {
        setState(1);
      }

      return state;
    }, onResult);

    await queueMacrotask(() => runningHook.stop());
    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([[0], [1]]);
    expect(createInitialState).toHaveBeenCalledTimes(1);
  });

  test('failing createInitialState()', async () => {
    const runningHook = run(() => {
      useState(() => {
        throw error;
      });

      return 0;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([]);
    expect(onError.mock.calls).toEqual([[error]]);
  });

  test('failing createState()', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      setState(() => {
        throw error;
      });

      return state;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);
    expect(onError.mock.calls).toEqual([[error]]);
  });

  test('failing effect()', async () => {
    const runningHook = run(() => {
      useEffect(() => {
        throw error;
      });

      return 0;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);
    expect(onError.mock.calls).toEqual([[error]]);
  });

  test('failing cleanUpEffect()', async () => {
    const cleanUpEffect = jest.fn();

    const runningHook = run(() => {
      useEffect(() => () => {
        throw error;
      });

      useEffect(() => cleanUpEffect);

      return 0;
    }, onResult);

    await queueMacrotask(() => runningHook.stop());
    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([[0]]);
    expect(cleanUpEffect).toHaveBeenCalledTimes(1);

    expect(consoleError.mock.calls).toEqual([
      ['Error while cleaning up effect.', error]
    ]);
  });

  test('failing onResult()', async () => {
    onResult.mockImplementation(() => {
      throw error;
    });

    const runningHook = run(() => {
      return 0;
    }, onResult);

    await runningHook.promise.catch(onError);

    expect(onResult.mock.calls).toEqual([[0]]);
    expect(onError.mock.calls).toEqual([[error]]);
  });

  test('different hook inputs', async () => {
    const effect1 = jest.fn();
    const effect2 = jest.fn();
    const effect3 = jest.fn();

    const runningHook = run(() => {
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
    }, onResult);

    await queueMacrotask(() => runningHook.stop());
    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([[0], [1], [2]]);
    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenCalledTimes(2);
    expect(effect3).toHaveBeenCalledTimes(3);
  });

  test('no more asynchronous results after immediate internal stop', async () => {
    let asyncTask: Promise<void>;

    const cleanUpEffect = jest.fn();

    const runningHook = run(() => {
      runningHook.stop();
      runningHook.stop();

      const [state, setState] = useState(0);

      useEffect(() => {
        setState(1);

        asyncTask = queueMacrotask(() => setState(2));

        return cleanUpEffect;
      });

      return state;
    }, onResult);

    await runningHook.promise;
    await asyncTask!;

    await queueMacrotask(() => {
      expect(onResult.mock.calls).toEqual([[0], [1]]);
      expect(cleanUpEffect).toHaveBeenCalledTimes(2);
    });
  });

  test('no results or effect calls after immediate external stop', async () => {
    const effect = jest.fn();

    const runningHook = run(() => {
      const [state] = useState(0);

      useEffect(effect);

      return state;
    }, onResult);

    runningHook.stop();
    runningHook.stop();

    await runningHook.promise;

    await queueMacrotask(() => {
      expect(onResult.mock.calls).toEqual([]);
      expect(effect).toHaveBeenCalledTimes(0);
    });
  });

  test('no more results or effect calls after error stop', async () => {
    let asyncTask: Promise<void>;

    const cleanUpEffect = jest.fn();

    const runningHook = run(() => {
      const [state, setState] = useState(0);

      useEffect(() => {
        setState(1);

        asyncTask = queueMacrotask(() => setState(2));

        return cleanUpEffect;
      });

      if (state === 1) {
        throw error;
      }

      return state;
    }, onResult);

    await runningHook.promise.catch(onError);
    await asyncTask!;

    await queueMacrotask(() => {
      expect(onResult.mock.calls).toEqual([[0]]);
      expect(cleanUpEffect).toHaveBeenCalledTimes(1);
    });
  });

  test('no error after normal stop', async () => {
    const runningHook = run(() => {
      runningHook.stop();

      throw error;
    }, onResult);

    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([]);
  });

  test('no more results without state change', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      setState(0);

      useEffect(() => {
        setState(0);
        setState(0);
        queueMacrotask(() => runningHook.stop());
      });

      return state;
    }, onResult);

    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([[0]]);
  });

  test('several results after state changes', async () => {
    const runningHook = run(() => {
      const [state1, setState1] = useState('a');
      const [state2, setState2] = useState('x');

      if (state1 === 'a') {
        setState1('b');
      }

      useEffect(() => {
        if (state1 === 'b') {
          setState2('y');
        }
      }, [state1]);

      useEffect(() => {
        if (state2 === 'y') {
          setState1('c');
        }
      }, [state2]);

      return state1 + state2;
    }, onResult);

    await queueMacrotask(() => runningHook.stop());
    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([['ax'], ['bx'], ['by'], ['cy']]);
  });

  test('asynchronous state changes', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      useEffect(() => {
        Promise.resolve().then(() => {
          setState(previousState => previousState + 1);
          setState(previousState => previousState + 1);
        });
      }, []);

      useEffect(() => {
        if (state === 2) {
          Promise.resolve().then(() => {
            setState(state);
            queueMacrotask(() => runningHook.stop());
          });
        }
      }, [state]);

      return state;
    }, onResult);

    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([[0], [2]]);
  });

  test('parallel running hooks', async () => {
    const runningHook1 = run(() => {
      const [state, setState] = useState(0);

      useEffect(() => {
        setState(previousState => previousState + 1);
      }, []);

      return state;
    }, onResult);

    const runningHook2 = run(() => {
      throw error;
    }, onResult);

    const runningHook3 = run(() => {
      const [state, setState] = useState(100);

      useEffect(() => {
        setState(previousState => previousState - 1);
      }, []);

      return state;
    }, onResult);

    await runningHook2.promise.catch(onError);

    await queueMacrotask(() => runningHook1.stop());
    await queueMacrotask(() => runningHook3.stop());

    await runningHook1.promise;
    await runningHook3.promise;

    expect(onResult.mock.calls).toEqual([[0], [1], [100], [99]]);
    expect(onError.mock.calls).toEqual([[error]]);
  });

  test('stable setState() identity', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      useEffect(() => {
        setState(previousState => previousState + 1);
      }, [setState]);

      return state;
    }, onResult);

    await queueMacrotask(() => runningHook.stop());
    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([[0], [1]]);
  });

  test('different callback inputs', async () => {
    const effect1 = jest.fn();
    const effect2 = jest.fn();
    const effect3 = jest.fn();

    const runningHook = run(() => {
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
    }, onResult);

    await queueMacrotask(() => runningHook.stop());
    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([[0], [1], [2]]);
    expect(effect1).toHaveBeenCalledTimes(1);
    expect(effect2).toHaveBeenCalledTimes(2);
    expect(effect3).toHaveBeenCalledTimes(3);
  });

  test('callback identity', async () => {
    const callback = jest.fn();
    const runningHook = run(() => useCallback(callback, []), onResult);

    await queueMacrotask(() => runningHook.stop());
    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([[callback]]);
    expect(callback).toHaveBeenCalledTimes(0);
  });

  test('ref-object persistence', async () => {
    const runningHook = run(() => {
      const [state, setState] = useState(0);

      useEffect(() => setState(1), []);

      const refObject = useRef(state);

      refObject.current += 1;

      return refObject.current;
    }, onResult);

    await queueMacrotask(() => runningHook.stop());
    await runningHook.promise;

    expect(onResult.mock.calls).toEqual([[1], [2]]);
  });
});
