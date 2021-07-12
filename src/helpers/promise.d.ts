
import {PromiseExtended, PromiseExtendedConstructor} from '../public/types/promise-extended';

export interface DexiePromise<T=any> extends PromiseExtended<T> {
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): DexiePromise<TResult1 | TResult2>;
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): DexiePromise<T | TResult>;
  catch<TResult = never>(ErrorConstructor: Function, onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): DexiePromise<T | TResult>;
  catch<TResult = never>(errorName: string, onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): DexiePromise<T | TResult>;
  finally<U>(onFinally?: () => U | PromiseLike<U>): DexiePromise<T>;
  timeout (ms: number, msg?: string): DexiePromise<T>;
  _state: null | true | false;
  _lib?: boolean;
}

export interface DexiePromiseConstructor extends PromiseExtendedConstructor {
  new <T>(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void): DexiePromise<T>;
  follow (fn: Function, zoneProps?: any): DexiePromise<void>;
  PSD: any,
  iea(): void;
  dea(): void;
  newPSD<R> (fn: (...args: any[])=>R, zoneProps?: any, ...args: any[]) : R;
  usePSD<R> (psd: any, fn: (...args: any[])=>R, ...args: any[]): R;
  rejectionMapper: (e?: any) => Error;
}

export const NativePromise : PromiseConstructor;
export var globalPSD;
export var PSD;
export function wrap<F extends Function>(f: F, errorCatcher?: (err) => void) : F;
export function newScope<T> (fn: (...args)=>T, props?, a1?, a2?) : T;
export function usePSD<T> (psd, fn: (...args)=>T, a1?, a2?, a3?) : T;
export function rejection (failure: any) : DexiePromise<never>;
export function incrementExpectedAwaits(): number;
export function decrementExpectedAwaits(sourceTaskId?: number): void;
export function beginMicroTickScope(): boolean;
export function endMicroTickScope(): void;
export declare var DexiePromise : DexiePromiseConstructor;

export default DexiePromise;
