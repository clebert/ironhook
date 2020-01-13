# ironhook

![](https://github.com/clebert/ironhook/workflows/CI/badge.svg)

A JavaScript library for reactive programming using React-like Hooks.

- **Small.** 1.18 KB (minified and gzipped).
- **No dependencies.** Not even React!

## Installation

Using `yarn`:

```
yarn add ironhook
```

Using `npm`:

```
npm install ironhook --save
```

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
is that this library executes a hook (aka `mainHook`) directly without a
surrounding function component. The first execution is scheduled as a macrotask
after `run(mainHook, onResult)` is called. The respective result of an execution
is forwarded to the `onResult(result)` handler as long as the result is not
`undefined`. All further executions can be initiated internally by using the
`useState` hook. The `mainHook` continues to run, i.e. it holds the state and
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

---

Copyright (c) 2020, Clemens Akens. Released under the terms of the
[MIT License](https://github.com/clebert/ironhook/blob/master/LICENSE).
