/* public/index.d.ts - The source of dexie.d.ts
 * 
 * We're using dts-bundle-generator to bundle this file to the
 * final version.
 * 
 * We're separating public from internal types as a way to keep package-private
 * properties and types without exposing them to the public API.
 * 
 * All internal types extends their corresponding public type though, so that
 * we still get the benefit from the tsc compilator checking type correctness.
 */

import { DexieConstructor} from './types/dexie-constructor';
declare var Dexie: DexieConstructor;

/* For backard compatibility, define a "module" Dexie and put types
 * such as Table in there as well. This must be in order for existing
 * samples and app code out there to work without modifications. Which
 * is very important as it would otherwise impose a lot of work for app
 * devs upgrading.
 */
import { Table } from './types/table';
import { Collection } from './types/collection';
import { PromiseExtended } from './types/promise-extended';
import { Observable } from './types/observable';
export { DexiePromiseConstructor } from '../helpers/promise';
import { IntervalTree, RangeSetConstructor } from './types/rangeset';

// Alias of Table and Collection in order to be able to refer them from module below...
interface _Table<T, TKey> extends Table<T, TKey> {}
interface _Collection<T,TKey> extends Collection<T,TKey> {}

// Besides being the only exported value, let Dexie also be
// a namespace for types...
declare module Dexie {
  // The "Dexie.Promise" type.
  type Promise<T=any> = PromiseExtended<T> // Because many samples have been Dexie.Promise.
  // The "Dexie.Table" interface. Same as named exported interface Table.
  interface Table<T=any,Key=any> extends _Table<T,Key> {} // Because all samples have been Dexie.Table<...>
  // The "Dexie.Collection" interface. Same as named exported interface Collection.
  interface Collection<T=any,Key=any> extends _Collection<T, Key> {} // Because app-code may declare it.
}

/** Explicitely export IndexableType. Mostly for backward compatibility.*/
export { IndexableType } from './types/indexable-type';

/** 'Dexie' is the only value export (non-type). Export it both by name and as a default export.
 * API user may choose whether to use the named or defualt export. All samples
 * have been using the default export until version 2.0.1.
*/
export { Dexie };
export function liveQuery<T>(querier: () => T | Promise<T>): Observable<T>;
export function mergeRanges(target: IntervalTree, newSet: IntervalTree): void;
export function rangesOverlap(
  rangeSet1: IntervalTree,
  rangeSet2: IntervalTree
): boolean;
declare var RangeSet: RangeSetConstructor;

/** Exporting 'Dexie' as the default export.
 **/
export default Dexie;
