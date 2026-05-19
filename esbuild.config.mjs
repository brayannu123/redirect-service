import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  minify: true,
  sourcemap: false,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
}).then(() => {
  console.log('⚡ Build complete');
}).catch(() => process.exit(1));
