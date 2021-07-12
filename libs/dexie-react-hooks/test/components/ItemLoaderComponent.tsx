import * as React from "react";
import { useLiveQuery } from "../../src";
import { Item } from "../models/Item";
import { ItemComponent } from "./ItemComponent";

export interface Props {
  id: number;
  loadItem: (id: number) => Promise<Item | undefined>;
}

export function ItemLoaderComponent({ id, loadItem }: Props) {
  const item = useLiveQuery(() => loadItem(id), [id], "loading");
  if (item === "loading") return <p>Loading...</p>;
  if (!item)
    return (
      <p className="not-found-item">
        <span>NOT_FOUND</span>: {id}
      </p>
    );
  return <ItemComponent item={item} />;
}
