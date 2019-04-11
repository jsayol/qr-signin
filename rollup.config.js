//@ts-check

import path from 'path';
import glob from 'glob';
import rimraf from 'rimraf';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';

// @ts-ignore
const pkg = require('./package.json');
const external = Object.keys(pkg.dependencies || {});

if (
  !['rtdb', 'firestore', 'mod-rtdb', 'mod-firestore'].includes(
    process.env.FLAVOR
  )
) {
  throw new Error(`Unknow flavor: "${process.env.FLAVOR}"`);
}

const outputDir = path.join(__dirname, 'dist', process.env.FLAVOR, 'lib');
rimraf.sync(outputDir);

export default {
  input: glob.sync('functions/src/**/*.ts'),
  output: {
    dir: outputDir,
    format: 'cjs',
    sourcemap: true
  },
  external: [...external, 'fs', 'crypto'],
  plugins: [
    resolve(),
    typescript({ cacheRoot: path.join(__dirname, '.rpt2_cache') }),
    replace({
      'process.env.FLAVOR': JSON.stringify(process.env.FLAVOR),
      'process.env.BUILD': JSON.stringify(process.env.BUILD || 'prod'),
      'process.env.NOT_MODS': JSON.stringify(process.env.NOT_MODS || false),
      'process.env.USE_EMULATOR': JSON.stringify(
        process.env.USE_EMULATOR || false
      ),
      ...(process.env.BUILD === 'dev'
        ? {
            'process.env.RTDB_QR_PATH': JSON.stringify('/qr_signin'),
            'process.env.QR_CODE_EXPIRATION_TIME': JSON.stringify('600000'), // 10 minutes
            'process.env.QR_CODE_ERROR_LEVEL': JSON.stringify('L')
          }
        : {})
    })
  ]
};
