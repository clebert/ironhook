# ironhook

[![][ci-badge]][ci-link] [![][version-badge]][version-link]
[![][license-badge]][license-link] [![][types-badge]][types-link]
[![][size-badge]][size-link]

[ci-badge]: https://github.com/clebert/ironhook/workflows/CI/badge.svg
[ci-link]: https://github.com/clebert/ironhook
[version-badge]: https://badgen.net/npm/v/ironhook
[version-link]: https://www.npmjs.com/package/ironhook
[license-badge]: https://badgen.net/npm/license/ironhook
[license-link]: https://github.com/clebert/ironhook/blob/master/LICENSE
[types-badge]: https://badgen.net/npm/types/ironhook
[types-link]: https://github.com/clebert/ironhook
[size-badge]: https://badgen.net/bundlephobia/minzip/ironhook
[size-link]: https://bundlephobia.com/result?p=ironhook

A JavaScript library for reactive programming using React-like Hooks.

## Installation

Using `yarn`:

```
yarn add ironhook
```

Using `npm`:

```
npm install ironhook --save
```

## Motivation

Reactive programming is generally understood to be programming using
asynchronous data streams, which form the conceptual basis for libraries like
RxJS. I never found the right access to the concepts and APIs of said libraries.

In React, the concept of so-called Hooks has become the standard pattern for
programming stateful, reactive functional components.

In contrast to the concept of streams, the concept of Hooks was something I
liked from the beginning. I find them very intuitive to write and read.

I wanted to use this kind of reactive programming also in other areas, for
example for the programming of web workers or server components. Therefore I
wrote this library.

## Usage Example

The following is a constructed example that demonstrates the use of this
library:

```js
import {run, useEffect, useState} from 'ironhook';

function useName() {
  const [name, setName] = useState('John Doe');

  useEffect(() => {
    setTimeout(() => setName('World'), 10);
  }, []);

  return name;
}

run(useName, name => {
  console.log(`Hello, ${name}!`);
}).promise.catch(error => {
  console.error(error);
});
```

Output:

```
Hello, John Doe!
Hello, World!
```

## API Reference

The [React Hooks API reference](https://reactjs.org/docs/hooks-reference.html)
also applies to this library and can be consulted. The main difference to React
is that this library executes a Hook (aka `mainHook`) directly without a
surrounding function component. The first execution is scheduled as a macrotask
after `run(mainHook, onResult)` is called. The respective result of an execution
is forwarded to the `onResult(result)` handler as long as the result is not
`undefined`. All further executions can be initiated internally by using the
`useState` Hook. The `mainHook` continues to run, i.e. it holds the state and
reacts to state changes until an error is thrown or the `stop()` method is
called. An error or stop has the same effect as unmounting a React function
component.

### Types

```ts
interface RunningHook {
  readonly promise: Promise<void>;

  stop(): void;
}

function run<TResult>(
  mainHook: () => TResult | undefined,
  onResult: (result: TResult) => void
): RunningHook;
```

### Implementation Status

Below you can see the reimplementation status of the various Hooks built into
React:

| Hook                                                                                     | Status               |
| ---------------------------------------------------------------------------------------- | -------------------- |
| [useState](https://reactjs.org/docs/hooks-reference.html#usestate)                       | ✅Implemented        |
| [useEffect](https://reactjs.org/docs/hooks-reference.html#useeffect)                     | ✅Implemented        |
| [useContext](https://reactjs.org/docs/hooks-reference.html#usecontext)                   | ❌Not planned        |
| [useReducer](https://reactjs.org/docs/hooks-reference.html#usereducer)                   | ⚠️[Planned][issue11] |
| [useCallback](https://reactjs.org/docs/hooks-reference.html#usecallback)                 | ✅Implemented        |
| [useMemo](https://reactjs.org/docs/hooks-reference.html#usememo)                         | ✅Implemented        |
| [useRef](https://reactjs.org/docs/hooks-reference.html#useref)                           | ✅Implemented        |
| [useImperativeHandle](https://reactjs.org/docs/hooks-reference.html#useimperativehandle) | ❌Not planned        |
| [useLayoutEffect](https://reactjs.org/docs/hooks-reference.html#uselayouteffect)         | ❌Not planned        |
| [useDebugValue](https://reactjs.org/docs/hooks-reference.html#usedebugvalue)             | ❌Not planned        |

[issue11]: https://github.com/clebert/ironhook/issues/11

## Development

### Publish A New Release

```
yarn release patch
```

```
yarn release minor
```

```
yarn release major
```

After a new release has been created by pushing the tag, it must be published
via the GitHub UI. This triggers the final publication to npm.

---

Copyright (c) 2020, Clemens Akens. Released under the terms of the
[MIT License](https://github.com/clebert/ironhook/blob/master/LICENSE).
