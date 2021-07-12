import * as React from "react";
import { Item } from "../models/Item";

interface Props {
  item: Item;
}

export function ItemComponent({ item: {id, name }}: Props) {
  return <div className="item-component" id={"item-" + id}>
    <p>ID: <span className="id-span">{id}</span></p>
    <p>Name: <span className="name-span">{name}</span></p>
  </div>;
}
