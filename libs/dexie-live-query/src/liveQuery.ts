import { isAsyncFunction, extendObservabilitySet } from "./helpers";
import Dexie, { ObservabilitySet, rangesOverlap, DexiePromiseConstructor } from "dexie";
import {
  Observable
} from "rxjs";

const DexiePromise = Dexie.Promise as DexiePromiseConstructor; // Reveals private properties of Dexie.Promise.
const {iea, dea, newPSD, usePSD} = DexiePromise;

export function liveQuery<T>(querier: () => T | Promise<T>): Observable<T> {
  return new Observable<T>((observer) => {
    const scopeFuncIsAsync = isAsyncFunction(querier);
    function execute(subscr: ObservabilitySet) {
      if (scopeFuncIsAsync) {
        iea();
      }
      const exec = () => newPSD(querier, { subscr, trans: null });
      const rv = DexiePromise.PSD.trans
        ? // Ignore current transaction if active when calling subscribe().
          usePSD(DexiePromise.PSD.transless, exec)
        : exec();
      if (scopeFuncIsAsync) {
        (rv as Promise<any>).then(dea, dea);
      }
      return rv;
    }

    let closed = false;

    let accumMuts: ObservabilitySet = {};
    let currentObs: ObservabilitySet = {};

    const subscription = {
      get closed() {
        return closed;
      },
      unsubscribe: () => {
        closed = true;
        Dexie.on.txcommitted.unsubscribe(mutationListener);
      },
    };

    let querying = false,
      startedListening = false;

    function shouldNotify() {
      return Object.keys(currentObs).some(
        (key) =>
          accumMuts[key] && rangesOverlap(accumMuts[key], currentObs[key])
      );
    }

    const mutationListener = (parts: ObservabilitySet) => {
      extendObservabilitySet(accumMuts, parts);
      if (shouldNotify()) {
        doQuery();
      }
    };

    const doQuery = () => {
      if (querying || closed) return;
      accumMuts = {};
      const subscr: ObservabilitySet = {};
      const ret = execute(subscr);
      if (!startedListening) {
        Dexie.on("txcommitted", mutationListener);
        startedListening = true;
      }
      querying = true;
      Promise.resolve(ret).then(
        (result) => {
          querying = false;
          if (closed) return;
          if (shouldNotify()) {
            // Mutations has happened while we were querying. Redo query.
            doQuery();
          } else {
            accumMuts = {};
            // Update what we are subscribing for based on this last run:
            currentObs = subscr;
            observer.next && observer.next(result);
          }
        },
        (err) => {
          querying = false;
          observer.error && observer.error(err);
          subscription.unsubscribe();
        }
      );
    };

    doQuery();
    return subscription;
  });
}
