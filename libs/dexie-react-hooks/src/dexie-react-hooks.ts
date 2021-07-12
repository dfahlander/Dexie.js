import {liveQuery} from "dexie";
import {useSubscription} from "./use-subscription";
import * as React from "react";

export function useLiveQuery<T>(querier: ()=>Promise<T> | T, dependencies?: any[]): T | undefined;
export function useLiveQuery<T,TDefault> (querier: ()=>Promise<T> | T, dependencies: any[], defaultResult: TDefault) : T | TDefault;
export function useLiveQuery<T,TDefault> (querier: ()=>Promise<T> | T, dependencies?: any[], defaultResult?: TDefault) : T | TDefault{
  const [lastResult, setLastResult] = React.useState(defaultResult as T | TDefault);
  const subscription = React.useMemo(
    () => {
      // Make it remember previous subscription's default value when
      // resubscribing (á la useTransition())
      let currentValue = lastResult;
      const observable = liveQuery(querier);
      return {
        getCurrentValue: () => currentValue,
        subscribe: (onNext, onError) => {
          const esSubscription = observable.subscribe(value => {
            currentValue = value;
            setLastResult(value);
            onNext(value);
          }, onError);
          return esSubscription.unsubscribe.bind(esSubscription);
        }
      };
    },
 
    // Re-subscribe any time any of the given dependencies change
    dependencies || []
  );
 
  // The value returned by this hook reflects the current result from the querier
  // Our component will automatically be re-rendered when that value changes.
  const value = useSubscription(subscription);
  return value;
}