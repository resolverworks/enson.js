import {defineConfig} from 'rollup';
import terser from '@rollup/plugin-terser';
import nodeResolver from '@rollup/plugin-node-resolve';

export default defineConfig([
	{
		input: './src/index.js',
		output: [
			{
				file: './dist/index.mjs',
				format: 'es',
			},
			{
				file: './dist/index.cjs',
				format: 'cjs',
			},
		],
		external: /^(@|node:)/
	},
	{
		input: './src/index.js',
		plugins: [nodeResolver()],
		output: [
			{
				file: './dist/index.min.js',
				format: 'es',
				plugins: [terser({
					compress: {
						toplevel: true,
						dead_code: true,
						passes: 2,
					},
				})],
			},
		],
	},
]);
