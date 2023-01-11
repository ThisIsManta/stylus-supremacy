require('esbuild').build({
	absWorkingDir: __dirname,
  entryPoints: ['./browserDemoSource.js'],
  bundle: true,
	platform: 'browser',
	format: 'cjs',
	minify: true,
  outfile: '../docs/demo.js',
	alias: {
		// Take out packages which cannot be run on a browser
		'assert': './empty.js',
		'buffer': './empty.js',
		'crypto': './empty.js',
		'events': './empty.js',
		'fs': './empty.js',
		'fs.realpath': './empty.js',
		'glob': './empty.js',
		'path': './empty.js',
		'string_decoder': './empty.js',
		'url': './empty.js',
		'util': './empty.js',
		'util': './empty.js',
	}
}).catch(() => process.exit(1))
