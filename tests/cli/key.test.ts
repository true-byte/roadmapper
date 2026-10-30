// The key of a roadmap file (src/cli/key.ts), which the app page keeps its view under: from the full path of the file alone.
/// <reference types="node" />
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { fileKey } from '../../src/cli/key';

test('the key of a file comes from its full path alone', () => {
  const key = fileKey('/home/me/shop/roadmap.json');
  expect(key).toMatch(/^[0-9a-f]{16}$/);
  expect(fileKey('/home/me/shop/../shop/roadmap.json'), 'the same file').toBe(key);
  expect(fileKey('/home/me/bakery/roadmap.json'), 'a file of the same name in another folder').not.toBe(key);
  expect(fileKey('roadmap.json'), 'a path from the folder the command runs in').toBe(fileKey(join(resolve('.'), 'roadmap.json')));
});
