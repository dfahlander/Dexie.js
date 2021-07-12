import * as React from "react";
import { useLiveQuery } from "../../src";
import { Item } from "../models/Item";
import { ItemComponent } from "./ItemComponent";

interface Props {
  loadItems: () => Promise<Item[]>;
}

export function ItemListComponent({ loadItems }: Props) {
  const items = useLiveQuery(loadItems);
  if (!items) return <p>Loading...</p>;
  return (
    <>
      <h3>Items found:</h3>
      <ul id="itemList">
        {items.map((item) => (
          <ItemComponent key={item.id} item={item} />
        ))}
      </ul>
    </>
  );
}
