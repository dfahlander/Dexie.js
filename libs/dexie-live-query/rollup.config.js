import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const ERRORS_TO_IGNORE = [
  "THIS_IS_UNDEFINED",
];

export default {
  input: './src/index.ts',
  output: [{
    file: 'dist/dexie-live-query.js',
    format: 'umd',
    globals: {dexie: "Dexie", rxjs: "Rx"},
    name: 'liveQuery',
    sourcemap: true
  },{
    file: 'dist/dexie-live-query.mjs',
    format: 'es',
    sourcemap: true
  }],
  external: ['dexie', 'rxjs'],
  plugins: [
    typescript(),
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
  ],
  onwarn ({loc, frame, code, message}) {
    if (ERRORS_TO_IGNORE.includes(code)) return;
    if ( loc ) {
      console.warn( `${loc.file} (${loc.line}:${loc.column}) ${message}` );
      if ( frame ) console.warn( frame );
    } else {
      console.warn(`${code} ${message}`);
    }    
  }
};
