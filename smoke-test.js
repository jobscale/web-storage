import { indexStore } from 'https://esm.sh/@jobscale/web-storage';

const logger = new Proxy(console, {
  get(target, prop) {
    return target[prop];
  },
});

const main = async () => {
  await indexStore.setItem('key-1', 'value-1');
  await indexStore.setItem('key-2', 'value-2');
  await indexStore.setItem('key-3', 'value-3');
  await indexStore.setItem('key-4', 'value-4');

  logger.info(await indexStore.getItem('key-1') === 'value-1');
  logger.info(await indexStore.getItem('key-2') === 'value-2');
  logger.info(await indexStore.getItem('key-3') === 'value-3');
  logger.info(await indexStore.getItem('key-4') === 'value-4');
};
main();
