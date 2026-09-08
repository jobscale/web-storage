# web-storage

### es module

```js
import { indexStore } from 'https://esm.sh/@jobscale/web-storage';

const main = async () => {
  await indexStore.setItem('key-1', 'value-1');
  await indexStore.setItem('key-2', 'value-2');
  await indexStore.setItem('key-3', 'value-3');
  await indexStore.setItem('key-4', 'value-4');

  console.info(await indexStore.getItem('key-1') === 'value-1');
  console.info(await indexStore.getItem('key-2') === 'value-2');
  console.info(await indexStore.getItem('key-3') === 'value-3');
  console.info(await indexStore.getItem('key-4') === 'value-4');
};
main();
```

### commonjs

```js
const pending = import('https://esm.sh/@jobscale/web-storage');

const main = async () => {
  const { indexStore } = await pending;

  await indexStore.setItem('key-1', 'value-1');
  await indexStore.setItem('key-2', 'value-2');
  await indexStore.setItem('key-3', 'value-3');
  await indexStore.setItem('key-4', 'value-4');

  console.info(await indexStore.getItem('key-1') === 'value-1');
  console.info(await indexStore.getItem('key-2') === 'value-2');
  console.info(await indexStore.getItem('key-3') === 'value-3');
  console.info(await indexStore.getItem('key-4') === 'value-4');
};
main();
```
