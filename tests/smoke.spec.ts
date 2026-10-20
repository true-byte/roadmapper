import { parseRoadmap } from '../src/roadmap/check';
import { errorList, expect, level, levels, openApp, openPlan, step, test } from './helpers';
import { flat, full, nested, nodesOf, plain } from './plans';

test("the app page draws his roadmap with the stops 'Main steps', 'Tracks', 'Every step', at the first", async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.roadmap .title')).toHaveText('Roadmapper');
  expect(await levels(page)).toEqual(['Main steps', 'Tracks', 'Every step']);
  expect(await level(page)).toBe('Main steps');
  await expect(page.locator('svg.plan g.zn[data-id]').first()).toBeAttached();
  await expect(errorList(page)).toBeHidden();
});

// the levels a plan has: one for each depth of groups, and 'Every step'; a plan opens at the first
const cases = [
  { name: 'plain', has: 'one group', plan: plain, stops: ['Main steps', 'Tracks', 'Every step'] },
  { name: 'nested', has: 'a group inside a group', plan: nested, stops: ['Main steps', 'Tracks', 'Every step'] },
  { name: 'full', has: 'groups four deep', plan: full, stops: ['Main steps', 'Tracks', 'Every step'] },
  { name: 'flat', has: 'no group', plan: flat, stops: ['Every step'] },
];
for (const { name, has, plan, stops } of cases) {
  test(`the test page draws the plan '${name}': ${has}, so the stops ${stops.join(', ')}, at the first`, async ({ page }) => {
    expect(() => parseRoadmap(structuredClone(plan))).not.toThrow();
    await openPlan(page, plan);
    await expect(page.locator('.roadmap .title')).toHaveText(plan.title);
    expect(await levels(page)).toEqual(stops);
    expect(await level(page)).toBe(stops[0]);
    // each node is drawn once, shown or not at this level
    await expect(page.locator('svg.plan g.zn[data-id]')).toHaveCount(nodesOf(plan).length);
    await expect(step(page, nodesOf(plan)[0].id)).toBeVisible();
    await expect(errorList(page)).toBeHidden();
  });
}
