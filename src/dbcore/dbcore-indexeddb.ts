import { DBCore, DBCoreWriteFailure, DBCoreWriteResponse, DBCoreCursor, DBCoreInsertRequest,
  DBCoreUpsertRequest, DBCoreOpenCursorRequest, DBCoreQueryRequest, DBCoreCountRequest,
  DBCoreSchema, DBCoreIndexSchema, KeyRange, DBCoreQueryResponse, RangeType } from './dbcore';
import { IDBObjectStore, IDBRequest, IDBCursor, IDBTransaction, IDBKeyRange, IDBCursorWithValue } from '../public/types/indexeddb';
import { isArray, trycatcher } from '../functions/utils';
import { eventRejectHandler, preventDefault } from '../functions/event-wrappers';
import { wrap, DexiePromise } from '../helpers/promise';

const cmp = indexedDB.cmp.bind(indexedDB);

export function arrayify<T>(arrayLike: {length: number, [index: number]: T}): T[] {
  return [].slice.call(arrayLike);
}
export function pick<T,Prop extends keyof T>(obj: T, props: Prop[]): Pick<T, Prop> {
  const result = {} as Pick<T, Prop>;
  props.forEach(prop => result[prop] = obj[prop]);
  return result;
}


// Into own module:
function mutate (op: 'add' | 'put' | 'delete', store: IDBObjectStore, args1: any[], args2?: any) : Promise<DBCoreWriteResponse> {
  return new Promise((resolve, reject) => {
    const length = args1.length;
    let req: IDBRequest & { _reqno?};
    let i: number;
    const failures: DBCoreWriteFailure[] = [];
    const errorHandler = op === 'delete' ?
      // It would be abnormal with an error on a delete operation
      eventRejectHandler(reject) :
      // Errors on put() and add() can be catchable constraint violations
      event => {
        preventDefault(event);
        failures.push({
          pos: (event.target as any)._reqno,
          reason: event.target.error
        });
      };
    const mutateOp = store[op].bind(store);
    if (args2) {
      for (i=0; i<length; ++i) {
        req = mutateOp(args1[i], args2[i]);
        req._reqno = i;
        req.onerror = errorHandler;
      }
    } else {
      for (i=0; i<length; ++i) {
        req = mutateOp(args1[i]);
        req._reqno = i;
        req.onerror = errorHandler;
      }
    }

    const done = wrap(event => {
      resolve({
        failures,
        lastKey: event.target.result
      });
    });

    req.onerror = event => { // wrap() not needed. All paths calling outside will wrap!
      errorHandler(event);
      done(event);
    };

    req.onsuccess = done;
  });
}

function openCursor ({trans, table, index, values, query, reverse, unique}: DBCoreOpenCursorRequest): Promise<DBCoreCursor>
{
  return new Promise((resolve, reject) => {
    const store = (trans as IDBTransaction).objectStore(table);
    // source
    const source = index == null ? store : store.index(index);
    // direction
    const direction = reverse ?
      unique ?
        "prevunique" :
        "prev" :
      unique ?
        "nextunique" :
        "next";
    // request
    const req = values ?
    source.openCursor(makeIDBKeyRange(query), direction) :
    source.openKeyCursor(makeIDBKeyRange(query), direction);
      
    // iteration
    req.onerror = eventRejectHandler(reject);
    req.onsuccess = wrap(ev => {
      const cursor = req.result as DBCoreCursor;
      if (!cursor) {
        resolve(null);
        return;
      }
      (cursor as any).done = false;
      const _cursorContinue = cursor.continue.bind(cursor);
      const _cursorContinuePrimaryKey = cursor.continuePrimaryKey.bind(cursor);
      const _cursorAdvance = cursor.advance.bind(cursor);
      const doThrowCursorIsStopped = ()=>{throw new Error("Cursor not started");}
      (cursor as any).trans = trans;
      cursor.stop = cursor.continue = cursor.continuePrimaryKey = cursor.advance = doThrowCursorIsStopped;
      cursor.next = function (this: DBCoreCursor) {
        // next() must work with "this" pointer in order to function correctly for ProxyCursors (derived objects)
        // without having to re-define next() on each child.
        let gotOne = 1;
        return this.start(() => gotOne-- ? this.continue() : this.stop()).then(() => this);
      };
      cursor.start = (callback) => {
        const iterationPromise = new Promise<void>((resolveIteration, rejectIteration) =>{
          req.onerror = eventRejectHandler(rejectIteration);
          cursor.stop = value => {
            cursor.stop = cursor.continue = cursor.continuePrimaryKey = cursor.advance = doThrowCursorIsStopped;
            cursor.fail = req.onerror = rejectIteration;
            resolveIteration(value);
          }
        });
        // Now change req.onsuccess to a callback that doesn't call initCursor but just observer.next()
        const guardedCallback = () => {
          if (req.result) {
            try {
              callback();
            } catch (err) {
              cursor.fail(err);
            }
          } else {
            (cursor as any).done = true;
            cursor.start = ()=>{throw new Error("Cursor behind last entry");}
            cursor.stop();
          }
        }
        req.onsuccess = wrap(() => {
          cursor.continue = _cursorContinue;
          cursor.continuePrimaryKey = _cursorContinuePrimaryKey;
          cursor.advance = _cursorAdvance;
          req.onsuccess = guardedCallback;
          guardedCallback();
        });
        guardedCallback();
        return iterationPromise;
      };
      resolve(cursor);
    }, reject); 
  });
}

function query (hasGetAll: boolean) {
  return (request: DBCoreQueryRequest) => {
    return new Promise<DBCoreQueryResponse>((resolve, reject) => {
      resolve = wrap(resolve);
      const {trans, table, index, values, limit, query} = request;
      const store = (trans as IDBTransaction).objectStore(table);
      const source = index == null ? store : store.index(index);
      const idbKeyRange = makeIDBKeyRange(query);
      if (hasGetAll) {
        const req = values ?
            source.getAll(idbKeyRange, limit) :
            source.getAllKeys(makeIDBKeyRange(query), limit);
        req.onsuccess = wrap(event => resolve({result: event.target.result}));
        req.onerror = eventRejectHandler(reject);
      } else {
        let count = 0;
        const req = values ?
          source.openCursor(idbKeyRange) :
          source.openKeyCursor(idbKeyRange);
        const result = [];
        req.onsuccess = event => {
          const cursor = req.result as IDBCursorWithValue;
          if (!cursor) return resolve({result});
          result.push(values ? cursor.value : cursor.primaryKey);
          if (++count === limit) return resolve({result});
          cursor.continue();
        };
        req.onerror = eventRejectHandler(reject);
      }
    });
  };
}

function extractSchema(db: IDBDatabase) : {schema: DBCoreSchema, hasGetAll: boolean} {
  const tables = arrayify(db.objectStoreNames);
  const trans = db.transaction(tables, 'readonly');
  return {
    schema: {
      name: db.name,
      tables: tables.map(table => trans.objectStore(table)).map(store => ({
        name: store.name,
        primaryKey: {
          isPrimaryKey: true,
          name: null,
          unique: true,
          compound: isArray(store.keyPath),
          ...pick(store, ["keyPath", "autoIncrement"])
        } as DBCoreIndexSchema,
        indexes: arrayify(store.indexNames).map(indexName => store.index(indexName))
          .map(index => ({
            ...pick(index, ["name", "keyPath", "unique", "multiEntry"]),
            compound: isArray(index.keyPath)
          } as DBCoreIndexSchema))
        }))
      },
    hasGetAll: tables.length > 0 && ('getAll' in trans.objectStore(tables[0]))
  };
}


function makeIDBKeyRange (range: KeyRange) : IDBKeyRange | null {
  const {lower, upper, lowerOpen, upperOpen} = range;
  const idbRange = lower === undefined ?
    upper === undefined ?
      null : //IDBKeyRange.lowerBound(-Infinity, false) : // Any range (TODO: Should we return null instead?)
      IDBKeyRange.upperBound(upper, !!upperOpen) : // below
    upper === undefined ?
      IDBKeyRange.lowerBound(lower, !!lowerOpen) : // above
      IDBKeyRange.bound(lower, upper, !!lowerOpen, !!upperOpen);
  return idbRange as IDBKeyRange;
}

export function createDBCore (db: IDBDatabase, indexedDB: IDBFactory) : DBCore {
  const {schema, hasGetAll} = extractSchema(db);
  return {
    transaction: db.transaction.bind(db),

    write ({trans, table, op, values, keys}) {
      return mutate(op === 'insert' ? 'add' : 'put',
        (trans as IDBTransaction).objectStore(table),
        values,
        keys);
    },

    delete ({trans, table, keys}) {
      return mutate(
        "delete",
        (trans as IDBTransaction).objectStore(table),
        keys)
      .then(({failures}) =>
        failures.length > 0 && Promise.reject(failures[0]));
    },

    deleteRange({trans, table, range}) {
      return mutate(
        "delete",
        (trans as IDBTransaction).objectStore(table),
        [range]
      ).then(({failures})=> failures.length && Promise.reject(failures[0]));
    },

    get ({trans, table, keys}) {
      return new Promise<any[]>((resolve, reject) => {
        resolve = wrap(resolve);
        const store = (trans as IDBTransaction).objectStore(table);
        const length = keys.length;
        const result = new Array(length);
        let resultPos = 0;
        let req: IDBRequest;
  
        const successHandler = event => {
          result[resultPos++] = event.target.result;
          if (resultPos === length) resolve(result);
        };
        const errorHandler = eventRejectHandler(reject);
  
        for (let i=0; i<length; ++i) {
          req = store.get(keys[i]);
          req.onsuccess = successHandler;
          req.onerror = errorHandler;
        }
      });
    },

    query: query(hasGetAll),
    
    openCursor,

    count (query) {
      return new Promise<number>((resolve, reject) => {
        const store = (query.trans as IDBTransaction).objectStore(query.table);
        const source = query.index == null ? store : store.index(query.index);
        const req = source.count(makeIDBKeyRange(query.query));
        req.onsuccess = wrap(ev => resolve(ev.target.result));
        req.onerror = eventRejectHandler(reject);
      });
    },

    cmp,

    schema

  };
}