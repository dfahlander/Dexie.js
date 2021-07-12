import * as React from "react";
import { db } from "../db";
import { ErrorBoundary } from "./ErrorBoundrary";
import { ItemListComponent } from "./ItemListComponent";
import { ItemLoaderComponent } from "./ItemLoaderComponent";

export function App() {
  const [currentId, setCurrentId] = React.useState(1);
  return <ErrorBoundary>
    <div id="list">
      <h2>All items</h2>
      <ItemListComponent loadItems={()=>db.items.toArray()} />
    </div>
    <div id="current">
        <h2>Current item</h2>
        <ErrorBoundary>
          <ItemLoaderComponent id={currentId} loadItem={(id: number)=>db.items.get(id)} />
        </ErrorBoundary>
    </div>
    <div id="controls">
      <button id="btnFirst" onClick={()=>setCurrentId(1)}>First</button>
      <button id="btnNext" onClick={()=>setCurrentId(prevId => prevId + 1)}>Next</button>
      <button id="btnInvalidKey" onClick={()=>setCurrentId(NaN)}>Select invalid key</button>
    </div>    
  </ErrorBoundary>;
}
