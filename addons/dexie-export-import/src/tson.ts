import Typeson from 'typeson';
import StructuredCloning from 'typeson-registry/dist/presets/structured-cloning';
import { encode as encodeB64, decode as decodeB64 } from 'base64-arraybuffer-es6';
import Dexie from 'dexie';
import { readBlobSync, readBlobAsync } from './helpers';
import typedArray from './tson-typed-array';
import arrayBuffer from './tson-arraybuffer';

export const TSON = new Typeson().register(StructuredCloning);

const readBlobsSynchronously = 'FileReaderSync' in self; // true in workers only.

let blobsToAwait: any[] = [];
let blobsToAwaitPos = 0;

// Need to patch encapsulateAsync as it does not work as of typeson 5.8.2
// Also, current version of typespn-registry-1.0.0-alpha.21 does not
// encapsulate/revive Blobs correctly (fails one of the unit tests in
// this library (test 'export-format'))
TSON.register([
  arrayBuffer,
  typedArray, {
    blob2: {
      test(x) { return Typeson.toStringTag(x) === 'Blob'; },
      replace(b) {
          if (b.isClosed) { // On MDN, but not in https://w3c.github.io/FileAPI/#dfn-Blob
            throw new Error('The Blob is closed');
          }
          if (readBlobsSynchronously) {
            const data = readBlobSync(b, 'binary');
            const base64 = encodeB64(data, 0, data.byteLength);
            return {
              type: b.type,
              data: base64
            }
          } else {
            blobsToAwait.push(b); // This will also make TSON.mustFinalize() return true.
            const result = {
              type: b.type,
              data: {start: blobsToAwaitPos, end: blobsToAwaitPos + b.size}
            }
            console.log("b.size: " + b.size);
            blobsToAwaitPos += b.size;
            return result;
          }
      },
      finalize(b, ba: ArrayBuffer) {
        b.data = encodeB64(ba, 0, ba.byteLength);
      },
      revive ({type, data}) {
        return new Blob([decodeB64(data)], {type});
      }
    }
  }
]);

TSON.mustFinalize = ()=>blobsToAwait.length > 0;

TSON.finalize = async (items?: any[]) => {
  const allChunks = await readBlobAsync(new Blob(blobsToAwait), 'binary');
  if (items) {
    for (const item of items) {
      // Manually go through all "blob" types in the result
      // and lookup the data slice they point at.
      if (item.$types) {
        let types = item.$types;
        const arrayType = types.$;
        if (arrayType) types = types.$;
        for (let keyPath in types) {
          const typeName = types[keyPath];
          const typeSpec = TSON.types[typeName];
          if (typeSpec && typeSpec.finalize) {
            const b = Dexie.getByKeyPath(item, arrayType ? "$." + keyPath : keyPath);
            typeSpec.finalize(b, allChunks.slice(b.data?.start, b.data?.end));
          }
        }
      }
    }
  }
  // Free up memory
  // Todo - this is the problematic one that causes the blobs to be reset everytime the `finalize` is
  //  called, where the chunks slicing are happening, which causes the data slicing with the wrong indices.
  //  need to figure out a different way to GC.
  // blobsToAwait = [];
}
