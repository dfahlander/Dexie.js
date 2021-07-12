import * as React from "react";
import * as ReactDOM from "react-dom";
import { module, test, equiv, assert } from "qunit";
import { db } from "./db";
import { BinarySemaphore } from "./utils/BinarySemaphore";
import { App } from "./components/App";
import { closest } from "./utils/closest";

const listChanged = new BinarySemaphore();
const currentChanged = new BinarySemaphore();
const rootChanged = new BinarySemaphore();
const mo = new MutationObserver(muts=>{
  rootChanged.post();
  if (muts.some(({target}) => closest(target, "div#list"))) {
    listChanged.post();
  } else if (muts.some(({target}) => closest(target, "div#current"))) {
    currentChanged.post();
  }
});
const div = document.createElement('div');
document.body.appendChild(div);
ReactDOM.render(React.createElement(App), div);
mo.observe(div, {subtree: true, childList: true, characterData: true});

module("useLiveQuery", {
  beforeEach (assert) {
    const done = assert.async();
    db.items.clear().then(async ()=>{
      listChanged.reset();
      currentChanged.reset();
      while(/Loading/i.test(div.innerText) || !/NOT_FOUND/i.test(div.innerText)) {
        listChanged.reset();
        currentChanged.reset();
        await Promise.race([listChanged, currentChanged]);
      }
      done();
    })    
  }
});

test("List component is reacting to changes", async ()=>{
  // Add items:
  listChanged.reset();
  await db.items.bulkPut([{
    id: 1,
    name: "Hello",
  }, {
    id: 2,
    name: "World"
  }]);
  console.log("after bulkPut");
  await listChanged;
  console.log("after await listChanged");
  const list = div.querySelector("ul#itemList");
  assert.equal(list?.textContent, "ID: 1Name: HelloID: 2Name: World", "The list should be populated");

  // Remove an item:
  listChanged.reset();
  db.items.delete(2);
  await listChanged;
  assert.equal(list?.textContent, "ID: 1Name: Hello", "The second item should have been removed");

  // Update an item:
  listChanged.reset();
  await db.items.update(1, {name: "Hola"});
  await listChanged;
  assert.equal(list?.textContent, "ID: 1Name: Hola", "The first item should have been updated");
});

test("ItemLoaderComponent is reacting to changes", async ()=>{
  const divCurrent = div.querySelector("div#current")!;
  let pNotFoundItem = divCurrent.querySelector("p.not-found-item");  
  // Initial value when loaded - should be "not found"
  assert.equal(pNotFoundItem?.textContent, "NOT_FOUND: 1", "Before we add anything - the component should say NOT_FOUND: 1");
  // Add items:
  currentChanged.reset();
  await db.items.put({
    id: 1,
    name: "Foo",
  });
  await currentChanged;
  let current = divCurrent.querySelector("div#item-1");
  assert.equal(current?.textContent, "ID: 1Name: Foo", "Current item should have been rendered");

  // Update it:
  currentChanged.reset();
  await db.items.update(1, {name: "Bar"});
  await currentChanged;
  assert.equal(current?.textContent, "ID: 1Name: Bar", "Current item should have been updated");

  // Remove it:
  currentChanged.reset();
  db.items.delete(1);
  await currentChanged;
  current = divCurrent.querySelector("div#item-1");
  pNotFoundItem = divCurrent.querySelector("p.not-found-item");
  assert.ok(!current, "Item 1 should not be in the DOM tree anymore");
  assert.equal(pNotFoundItem?.textContent, "NOT_FOUND: 1", "After deleting it - the component should say NOT_FOUND: 1");
});

test("Clicking next button will update the currently viewed item", async ()=>{
  const divCurrent = div.querySelector("div#current")!;
  currentChanged.reset();
  // Add items:
  await db.items.bulkPut([{
    id: 1,
    name: "Hello",
  }, {
    id: 2,
    name: "World"
  }]);

  await currentChanged;
  assert.equal(divCurrent.textContent, "Current itemID: 1Name: Hello", "We are now vieweing item 1");

  // Click next button and verify we are then viewing item 2
  currentChanged.reset();
  const btnNext = div.querySelector("#btnNext");
  // Click button:
  (btnNext as HTMLElement).click();
  await currentChanged;
  // While loading number 2, wait till it's not loading anymore:
  while(/loading/i.test(divCurrent.textContent!)) {
    currentChanged.reset();
    await currentChanged;
  }
  assert.equal(divCurrent.textContent, "Current itemID: 2Name: World", "We are now viewering item 2");
});

test("Selecting invalid key trigger the err-boundrary", async ()=>{
  // Stop test from failing because we trigger an error!
  QUnit["onUnhandledRejection"] = ()=>{};

  listChanged.reset();
  currentChanged.reset();
  // Add some data:
  await db.items.bulkPut([{
    id: 1,
    name: "Hello",
  }, {
    id: 2,
    name: "World"
  }]);

  // Wait for both parts to update...
  await Promise.all([listChanged, currentChanged]);

  // Now click the invalid key and wait for a render:
  rootChanged.reset();
  // Click a bad button:
  (div.querySelector("#btnInvalidKey") as HTMLElement).click();
  while (!/Something went wrong/g.test(div.innerText)) {
    await rootChanged;
    rootChanged.reset();
  }
  assert.ok(/Something went wrong/.test(div.innerText), "The ErrorBoundrary should be shown");
  
  // Restore the gui from the error state:
  (div.querySelector("#btnFirst") as HTMLElement).click();
  (div.querySelector("#btnRetry") as HTMLElement).click();
});
