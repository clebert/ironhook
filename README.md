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
[RxJS][rxjs] or [xstream][xstream]. In React, however, reactive programming is
not about dealing with streams, but with so-called
[Hooks](https://reactjs.org/docs/hooks-intro.html#motivation).

A component is rendered, whereby side effects are declared based on its current
state (using the
[`useEffect`](https://reactjs.org/docs/hooks-overview.html#effect-hook) Hook),
which in turn can lead to state changes (using the
[`useState`](https://reactjs.org/docs/hooks-overview.html#state-hook) Hook) and
thus to further renderings.

In contrast to the concept of streams, the concept of Hooks was something I
liked from the beginning. I find them very intuitive to read and write. I wanted
to use this kind of reactive programming in other areas as well, for example for
programming web workers, AWS Lambda handlers, or even JavaScript-controlled
robots. Therefore I wrote this library.

[rxjs]: https://github.com/ReactiveX/rxjs
[xstream]: https://github.com/staltz/xstream

## Usage Example

The following is a constructed example that demonstrates the use of this
library:

```js
import {Subject, useEffect, useState} from 'ironhook';

function useName() {
  const [name, setName] = useState('World');

  useEffect(() => {
    setTimeout(() => setName('John Doe'), 10);
  }, []);

  return name;
}

const subject = new Subject(useName);

subject.subscribe({
  next: name => console.log(`Hello, ${name}!`)
});
```

Output:

```
Hello, World!
Hello, John Doe!
```

## API Reference

The [React Hooks API reference](https://reactjs.org/docs/hooks-reference.html)
also applies to this library and should be consulted.

### Implementation Status

Below you can see the implementation status of the various Hooks provided by
React:

| Hook                                         |                                        | Status        |
| -------------------------------------------- | -------------------------------------- | ------------- |
| [`useState`][usestate]                       | `import {useState} from 'ironhook'`    | ✅Implemented |
| [`useEffect`][useeffect]                     | `import {useEffect} from 'ironhook'`   | ✅Implemented |
| [`useReducer`][usereducer]                   | `import {useReducer} from 'ironhook'`  | ✅Implemented |
| [`useCallback`][usecallback]                 | `import {useCallback} from 'ironhook'` | ✅Implemented |
| [`useMemo`][usememo]                         | `import {useMemo} from 'ironhook'`     | ✅Implemented |
| [`useRef`][useref]                           | `import {useRef} from 'ironhook'`      | ✅Implemented |
| [`useContext`][usecontext]                   |                                        | ❌Not planned |
| [`useImperativeHandle`][useimperativehandle] |                                        | ❌Not planned |
| [`useLayoutEffect`][uselayouteffect]         |                                        | ❌Not planned |
| [`useDebugValue`][usedebugvalue]             |                                        | ❌Not planned |

[usestate]: https://reactjs.org/docs/hooks-reference.html#usestate
[useeffect]: https://reactjs.org/docs/hooks-reference.html#useeffect
[usecontext]: https://reactjs.org/docs/hooks-reference.html#usecontext
[usereducer]: https://reactjs.org/docs/hooks-reference.html#usereducer
[usecallback]: https://reactjs.org/docs/hooks-reference.html#usecallback
[usememo]: https://reactjs.org/docs/hooks-reference.html#usememo
[useref]: https://reactjs.org/docs/hooks-reference.html#useref
[useimperativehandle]:
  https://reactjs.org/docs/hooks-reference.html#useimperativehandle
[uselayouteffect]: https://reactjs.org/docs/hooks-reference.html#uselayouteffect
[usedebugvalue]: https://reactjs.org/docs/hooks-reference.html#usedebugvalue

### Implementation Notes

This library implements the
[observer pattern](https://en.wikipedia.org/wiki/Observer_pattern):

> The observer pattern is a software design pattern in which an object, called
> the subject, maintains a list of its dependents, called observers, and
> notifies them automatically of any state changes, usually by calling one of
> their methods.

The main difference to React is that this library calls a Hook (aka `mainHook`)
directly, without the need for a surrounding function component. The first
execution of the `mainHook` is scheduled as a microtask (i.e. asynchronous)
after the first call of `Subject.subscribe(observer)`. All further executions
can be scheduled internally with the `useState` or `useReducer` Hooks. The
`mainHook` continues to run, i.e. it maintains its state and is re-executed on
state changes until an error is thrown or the `Subject.complete()` method is
called. An error or completion has the same effect as unmounting a React
function component.

### Types

```ts
class Subject<TValue> {
  constructor(mainHook: MainHook<TValue>);

  subscribe(observer: Observer<TValue>): Unsubscribe;
  complete(): void;
}
```

```ts
type MainHook<TValue> = () => TValue;
```

```ts
interface Observer<TValue> {
  next(value: TValue): void;
  error?(error: Error): void;
  complete?(): void;
}
```

```ts
type Unsubscribe = () => void;
```

**Note:** The `Observer` interface is intentionally compatible with the
[`Observer`](https://github.com/ReactiveX/rxjs/blob/master/doc/observer.md) from
RxJS and the [`Listener`](http://staltz.github.io/xstream/#listener) from
xstream.

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
