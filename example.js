const {Subject, useEffect, useState} = require('./lib');

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
