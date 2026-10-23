---
name: roadmapper
description: This skill says how to write and change a roadmap file for Roadmapper. A roadmap file is a JSON file, such as roadmap.json, that Roadmapper draws as a tree of steps. In a good roadmap file, a step comes after another step only when it waits for that step. A roadmap file plans any goal that takes steps, such as opening a shop, a wedding, a move, a research project or a product launch. Use this skill to create a roadmap file, or to add, move, split or remove its steps. Use it also to mark steps started, done or canceled, to reshape a plan, or to check whether a plan is right. Use it even for a short request, such as "mark the ovens done", "add a delivery van to the plan" or "review the roadmap".
---

# Keep a roadmap file

This doc covers how to write and change a roadmap file: where each step goes, which keys it gets, and the checks before you answer.

Roadmapper draws a roadmap file as a tree on a page. The owner is the person, or the people, whose plan it is. The owner reads the page, not the file. The page shows what is done, what is in progress, and which step waits for which. So the shape of the tree is the plan. A wrong shape makes the plan wrong, however good its words are.

A roadmap file plans any goal that takes steps, such as opening a shop, a wedding, a move, a research project or a product launch. Each rule in this doc holds for every kind of goal. Write each step in the words that the owner uses for the goal.

[format.md](format.md), next to this doc, gives every key, value, state and error of a roadmap file. Read it before you write a roadmap file. This doc says how to use those keys well.

All examples in this doc come from one plan: opening a bakery. [format.md, section "Example"](format.md#example) gives that plan in full. Each example here shows only the items and keys that its rule needs. Some examples name a step or a change that the plan could get later, such as 'Bank lends the money'.

## A line means "waits for"

An item is a step or a split. On a branch, a line joins each item to the next item. A reader takes that line to mean that the next item cannot start until this item is done. When that is not true, the line is wrong.

In this doc, a wait means that one step waits for another step. A line shows a wait, or `waitsFor` does, as [Pick the piece that says what you mean](#pick-the-piece-that-says-what-you-mean) says.

- Put a step after another step only when it needs that step done first.
- Before you place a step, find what it needs done first, and put the step right after that.
- Put steps that do not need each other side by side, in a `split`. The branches of the split join right before the first step that needs them all.
- The order that you plan to work in is no reason for a line. A split says only that its branches need no order between them. So a split also fits an owner who does one thing at a time.

The most common mistake is a long row of steps that do not need each other. Its wrong lines hide the lines that are true.

This row is wrong:

```json
{ "id": "sign-the-lease", "name": "Sign the lease", "state": "done" },
{ "id": "install-ovens", "name": "Install ovens" },
{ "id": "build-the-counter", "name": "Build the counter" },
{ "id": "town-gives-the-food-permit", "name": "Town gives the food permit" },
{ "id": "hire-bakers", "name": "Hire bakers" },
{ "id": "pick-the-recipes", "name": "Pick the recipes" },
{ "id": "print-the-menu", "name": "Print the menu" },
{ "id": "opening-day", "name": "Opening day", "milestone": true }
```

The row has three wrong lines:

- 'Build the counter' does not need 'Install ovens'.
- 'Hire bakers' does not need 'Town gives the food permit'.
- 'Pick the recipes' does not need 'Hire bakers'.

This plan is right. It holds the same steps, and each line joins a step to a step that it needs:

```json
{ "branching": true, "split": [
  { "name": "Shop", "items": [
    { "id": "sign-the-lease", "name": "Sign the lease", "state": "done" },
    { "name": "Fit out the shop", "split": [
      { "name": "Kitchen", "items": [ { "id": "install-ovens", "name": "Install ovens" } ] },
      { "name": "Front", "items": [ { "id": "build-the-counter", "name": "Build the counter" } ] }
    ] },
    { "id": "town-gives-the-food-permit", "name": "Town gives the food permit" }
  ] },
  { "name": "Staff", "items": [ { "id": "hire-bakers", "name": "Hire bakers" } ] },
  { "name": "Recipes", "items": [
    { "id": "pick-the-recipes", "name": "Pick the recipes" },
    { "id": "print-the-menu", "name": "Print the menu" }
  ] }
] },
{ "id": "opening-day", "name": "Opening day", "milestone": true }
```

- 'Shop', 'Staff' and 'Recipes' are side by side, because no step on one of them needs a step on another.
- 'Install ovens' and 'Build the counter' are side by side, because neither one needs the other.
- The branches 'Shop', 'Staff' and 'Recipes' join right before 'Opening day', which needs them all.

## Groups and branchings

A split is a group or a branching. The two hold different kinds of work:

- A group is one piece of work, and its tracks are the parts of that work. 'Fit out the shop' is a group with the tracks 'Kitchen' and 'Front'. At the level 'Main steps', a group shows as one step.
- A branching holds separate pieces of work side by side, each with a goal of its own. 'Shop', 'Staff' and 'Recipes' are a branching. Write `"branching": true` on its split. The branches of a branching show at every level.

To choose, try to name the whole split as one step, in the owner's words. If one step name covers it, such as 'Fit out the shop', use a group. If only a list of names covers it, such as 'Shop', 'Staff' and 'Recipes', use a branching. If you cannot tell, use a branching.

- Name each top-level branch, group, track and branch of a branching by what it holds, in the owner's words.
- When a step joins a branch, a track or a group, rename that branch, track or group if its name no longer covers all that it holds.
- The page shows a branching by the names of its branches, so a branching needs no `name`.
- Keep groups shallow where you can. At the level 'Tracks', every group is open, so each group inside a group makes that level more crowded.

## Place each step after what it needs

The rules of a line hold at every depth. Steps in a row inside a track also wait for each other.

- When a step needs only some branches of a split, put the step after a split that holds only those branches.
- The branches of a split can all start at once. So a step that waits for a step on another branch of the same split is in the wrong place. Put it on that other branch, after the step that it waits for.
- Decide the waits one piece of work at a time, and keep the steps of one piece of work together. When a piece of work needs what another piece of work makes, put it after that other piece of work, on the same branch. 'Print the menu' needs the recipes, so it goes after 'Pick the recipes' on the branch 'Recipes'.

### When no split fits

No split fits when one step needs two steps that do not need each other, and another step needs only one of those two. Inside one top-level branch, every way to place these steps draws at least one wrong line.

In the bakery plan, 'Make the sign' needs 'Sign the lease' and 'Pick a name'. The sign shows the name, and it must fit the front of the shop. The steps of 'Fit out the shop' need only 'Sign the lease'.

In this case, do these three things, in order:

1. Of the two steps that the step with two waits needs, take the one that no other step needs. Put it on a top-level branch of its own. In the bakery plan, that step is 'Pick a name'.
2. Put the step with two waits after it, on the same top-level branch. In the bakery plan, 'Make the sign' goes after 'Pick a name', on the top-level branch 'Name'.
3. Give `waitsFor` to each step that waits for a step on another top-level branch. In the bakery plan, 'Make the sign' waits for 'Sign the lease', and 'Opening day' waits for 'Make the sign'.

In this example, `[ … ]` stands for the split of 'Shop', 'Staff' and 'Recipes' in the right plan of [A line means "waits for"](#a-line-means-waits-for):

```json
"branches": [
  { "name": "First shop", "items": [
    { "branching": true, "split": [ … ] },
    { "id": "opening-day", "name": "Opening day", "milestone": true, "waitsFor": ["make-the-sign"] }
  ] },
  { "name": "Name", "items": [
    { "id": "pick-a-name", "name": "Pick a name" },
    { "id": "make-the-sign", "name": "Make the sign", "waitsFor": ["sign-the-lease"], "why": "The sign shows the name and fits the front of the shop." }
  ] }
]
```

## The test of a good plan

The owner asks: "What can we work on now, side by side?" The page alone must answer that question.

- The answer is the first step on each branch that is neither done nor canceled, unless that step is blocked or `"tbd"`. In the bakery plan, the answer is 'Install ovens', 'Build the counter', 'Hire bakers', 'Pick the recipes' and 'Pick a name'.
- No line on the page is wrong.

If your answer needs a "but" or a "not sure", the plan is not done yet.

## Decide each wait

Decide each wait before you save, in a new plan and in each change to a plan.

- Write each wait that the owner states.
- When the owner says that a step needs a thing, such as the name, the step waits for the step that makes that thing. 'Make the sign' needs the name, so it waits for 'Pick a name'. When no step in the plan makes that thing, ask the owner which step makes it.
- Words such as "first", "then" or "later" say when the owner plans to work. They do not say which step waits. "Sign the lease first" puts no line from 'Sign the lease' to 'Hire bakers'.
- For any other wait, read the `why` and the `doneWhen` of both steps. Read also what the owner has said or written about them.
- A wait is sure when the names of the steps, their `why`, their `doneWhen` or the owner's words make it plain. The menu lists the recipes, so 'Print the menu' waits for 'Pick the recipes'.
- If you are still not sure of a wait, ask the owner one short question before you save. Ask even when the owner asked for the whole plan at once.
- When the owner names a part of the plan but no step in it, ask the owner one short question about its steps. Such a part can be a phase or a year.
- When the owner names the things that a part of the plan brings, write a step for each thing. For example, the owner says that 'Fit out the shop' brings the ovens and the counter. Then write the steps 'Install ovens' and 'Build the counter'. Make each such step exact or "tbd", as [Make near steps exact and far steps "tbd"](#make-near-steps-exact-and-far-steps-tbd) says.
- Never save a plan with a wait that you are not sure of. Never give the owner a list of doubts in place of the plan.
- Where a wait is not plain from the names, write it in the `why` of the step that waits. Then the next person who reshapes the plan keeps the wait.

## Add to a plan that has wrong lines

Put new work right after what it needs. When a wrong line is next to that place, remove that line in the same change. Do these three things, in order:

1. Put the steps that are not done and do not need each other side by side.
2. Keep each wait that is true.
3. Tell the owner in one sentence what else moved.

When you move a step, it loses every wait that its lines gave it. It loses both what it waited for and what waited for it. Drop only the waits that you know are wrong. Show each other wait again: by a line, or by `waitsFor` where the other step is on another top-level branch.

New work may go next to an old row of steps that do not need each other. Then never move that row into a track or group whose name tells the owner nothing. 'Other tasks' and 'Rest of the fit-out' are such names. Inside such a track or group, the row still has its wrong lines.

- At the level 'Main steps', a group with no `name` shows how many tracks it has, such as '3 tracks', when the names of its tracks do not fit. That tells the owner nothing. So give a group of many tracks a short `name` of what it holds or makes.
- A group of separate pieces of work also tells the owner nothing. Put those pieces in a branching, where each one shows on its own.

Done steps stay where they are, because they show how the work went. Move only steps that are not done.

In a new plan, place a done step by its waits, as any other step. In the bakery plan, 'Sign the lease' is done. On the top-level branch 'First shop', only the steps on the branch 'Shop' need it. So 'Sign the lease' is the first step of 'Shop'. It does not go before the split of 'Shop', 'Staff' and 'Recipes'.

A wait for a done step counts as any other wait. So 'Make the sign' still waits for 'Sign the lease', by `waitsFor`, as [When no split fits](#when-no-split-fits) says.

## Pick the piece that says what you mean

| What you mean | The piece |
|---|---|
| Steps where each one needs the one before | The items of one branch, in order. |
| Parts of one piece of work, done in any order, such as the kitchen and the front of 'Fit out the shop' | A group: a `split` with no `"branching": true` and no branch with `"ends": true`. Give it a `name`. |
| Separate pieces of work side by side, all needed by the next step, such as 'Shop', 'Staff' and 'Recipes' before 'Opening day' | A branching that comes back: a `split` with `"branching": true`. |
| A side branch that leaves and does not come back, such as a stall at the summer market | A branching that ends: a `split` with a branch that has `"ends": true`. |
| Parts of the plan that the owner plans on their own, such as the first shop and a second shop. One part may wait for another. | Top-level `branches`. |
| A later part of the plan that can start only after a milestone of an earlier part, such as a second shop after 'Opening day' | A top-level branch whose first step waits for that milestone, by `waitsFor`. |
| A step that needs two steps that do not need each other, when another step needs only one of them, such as 'Make the sign' | A top-level branch of its own, as [When no split fits](#when-no-split-fits) says. |
| A step that waits for a step on another top-level branch | `waitsFor` on the step that waits. |
| A step that waits for something outside the plan, such as a bank or a supplier | A step of its own for that, such as 'Bank lends the money'. |
| Work that may not happen at all, such as a delivery service | A step with the state `"tbd"`. |

Place a step for something outside the plan, or for work that may not happen, as you place any step:

- When it waits for a step in the plan, put it right after that step.
- When it waits for nothing in the plan, put it on a branch of its own in a split.
- When it needs a thing that no step in the plan makes, ask the owner which step makes it, as [Decide each wait](#decide-each-wait) says.
- When [When no split fits](#when-no-split-fits) puts it on a top-level branch of its own, give it `waitsFor`. List each step that it waits for on another top-level branch.

Something outside the plan can still wait for a step in the plan. The town gives the food permit only after it inspects the finished shop. So 'Town gives the food permit' comes right after 'Fit out the shop'. Decide such a wait as [Decide each wait](#decide-each-wait) says.

- Name the step by what the next step needs from outside, such as 'Bank lends the money' or 'Town gives the food permit'.
- Add the owner's own step to ask for it, such as 'Apply for the food permit', only when the owner names that step.

No line joins two top-level branches. So `waitsFor` is the only way to show that a step waits for a step on another top-level branch.

- Use `waitsFor` only for a wait on another top-level branch. Inside one top-level branch, show each wait by a line.
- Never write a `waitsFor` between two branches of one split. The page then draws a branch that looks free to start, but is blocked. Place the step as [Place each step after what it needs](#place-each-step-after-what-it-needs) says.
- Write no `waitsFor` for what a line already shows. A step already waits for the step right before it on the same branch.
- Never write `"state": "blocked"`, because it is an error. When a step waits for a step on another top-level branch, write that step in `waitsFor`. The page then draws the waiting step as blocked until that step is done or canceled.

## The keys of a step

| Key | What to write |
|---|---|
| `id` | Write the name in lowercase, with `-` between the words, such as `sign-the-lease`. When that id is taken, add `-2`, then `-3`, such as `test-bake-2` for a second step named 'Test bake'. Never change an id once it exists, even when you rename or move the step. |
| `name` | Write a few words that the owner would use. Steps on different branches may have the same name, such as 'Test bake' on the branch 'Bread' and on the branch 'Cakes'. |
| `why` | Write one line on why the step is there, such as 'The bread needs two big ovens.' |
| `doneWhen` | Write a check that a person can do, such as 'Both ovens bake a test batch.' A check names what a person can see or count. A word such as 'ready' or 'good' alone is a wish, not a check. |
| `state` | Write `"in-progress"` when work starts, and `"done"` when the `doneWhen` check passes. Write `"canceled"` when the owner drops planned work. Keep the canceled step, so that the plan keeps its history. |
| `milestone` | Write `true` only for the few big moments, such as 'Opening day'. |
| `start`, `end`, `deadline` | Write a day only when the owner has set that day. When the owner names only a month, a season or a span, such as "next June" or "in three months", write no day. Write what the owner named in the `why` of the step that it is for. Write a month with its year, such as 'June 2027', in place of "next June". The month of the goal is for the milestone of the goal. So for "we open next June", the `why` of 'Opening day' says 'The bakery opens in June 2027.' Write a span of the whole plan in `about`, and a span of a top-level branch in its `holds`. |
| `icon` | Write only a name that is in the icon set, such as `bread`. [format.md, section "Icons"](format.md#icons) names the set, and says how to check a name. The `validate` command does not find a wrong name, so leave `icon` out when you are not sure. |
| `links` | Write a link only to a page that you know exists, such as the signed lease at the address that the owner gave. Never guess an address. Copy it in full, from `https://` or `http://`. Pick its `icon` as for the `icon` of a step, such as `file-text` for a doc. |

Write each `why` and `doneWhen` as a plain fact in the third person, such as 'The town sends the signed permit.'

## Make near steps exact and far steps "tbd"

A step is near when it is in progress or can start now. A step is near too when each step that it waits for is done, canceled or in progress, or can start now. Every other step is far. In the bakery plan, 'Print the menu' is near, because it waits only for 'Pick the recipes', which can start now. 'Second shop' is far.

- Give each near step a clear `why` and a `doneWhen`.
- When the owner gave no check, write the simplest check that fits the name of the step. For 'Make the sign', that check is 'The sign hangs over the door.' Write no count, name or day that the owner did not give.
- Give each far step a name and the state `"tbd"`. A `why` is optional, and a far step has no `doneWhen`. This holds even when the owner named the step, because its detail is still a guess.
- A milestone that the owner set as the goal, such as 'Opening day', stays exact however far it is. Give it a `why` and a `doneWhen`.
- When a far step becomes near, make it exact then.
- Invent no detail for a far step. Add no step from a guess about what the owner might want. Ask the owner instead.

## Plan only the work

The plan shows the work toward the goal, the way the owner thinks of it. It does not record who worked on what, or when. Your own mistakes and their fixes are never steps.

## Before you answer

1. Read the plan as the page shows it. Go along each branch from its first item to its last. For each line, say what the next item waits for, such as "'Fit out the shop' waits for 'Sign the lease'". Where that is not true, move the next item.
2. For each step that you moved, list what it waited for and what waited for it before the move. Each of those waits must still be there, by a line, or by `waitsFor` where it is on another top-level branch. Only a wait that you know was wrong may go.
3. Answer the question of [The test of a good plan](#the-test-of-a-good-plan).
4. Check that every step from before keeps its `id`.
5. Save the file. Then run Roadmapper's `validate` command on it yourself. Do not ask the owner to run it. The command needs Node. Run it in a folder where Roadmapper is installed. Give it the path of the roadmap file, which may be in any folder:

   ```sh
   npx roadmapper validate roadmap.json
   ```

   The command prints each error on a line of its own. [format.md, section "Errors"](format.md#errors) says what each error means. Fix each error, and run the command again until it prints `roadmap.json: no errors`.

## When you are done

- Write only the roadmap file, unless the owner asks for more.
- Tell the owner in one or two sentences what changed on the page.
