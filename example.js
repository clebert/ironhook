const {run, useEffect, useState} = require('./lib');

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
