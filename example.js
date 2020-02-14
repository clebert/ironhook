// @ts-check

// import * as Ironhook from 'ironhook';
const Ironhook = require('./lib/cjs');

function useName() {
  const [name, setName] = Ironhook.useState('World');

  Ironhook.useEffect(() => {
    setTimeout(() => setName('John Doe'), 10);
  }, []);

  return name;
}

const nameSubject = new Ironhook.Subject(useName);

nameSubject.subscribe({
  next: name => console.log(`Hello, ${name}!`),
  error: error => console.error('Oops!', error),
  complete: () => console.log('Bye.')
});
