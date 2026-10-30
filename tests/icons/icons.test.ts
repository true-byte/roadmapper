// The license of Tabler Icons, the set the theme names: src/icons/tabler.ts gives it to the set, and it ships with the drawings in each built file that holds them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { info } from '@iconify-json/tabler';
import { expect, test } from '@playwright/test';
import { tabler } from '../../src/icons/tabler';

test('the Tabler set carries the MIT notice of its author', () => {
  expect(info.license.spdx).toBe('MIT');
  expect(tabler.license).toMatch(/^MIT License\n/);
  expect(tabler.license).toContain(`Copyright (c) 2020-2026 ${info.author?.name}`);
  expect(tabler.license).toContain('Permission is hereby granted, free of charge');
});

test('each built file with Tabler drawings carries the MIT notice', () => {
  // the app page that `build` fills, the app page built on the fixture, the lib as one script, and the set apart for the lib and for `export`
  for (const file of ['dist/cli/app.html', 'dist/tests/app/index.html', 'dist/lib/roadmapper.js', 'dist/lib/tabler.js', 'dist/cli/tabler.js']) {
    const built = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    // as written, or as a string in quotes
    expect(built.includes(tabler.license) || built.includes(JSON.stringify(tabler.license)), file).toBe(true);
  }
});
