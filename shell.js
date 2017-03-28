const ps = require('process')
const fs = require('fs')
const glob = require('glob')
const stylus = require('stylus')
const _ = require('lodash')
const { format } = require('./index.js')

const files = _.chain(ps.argv.slice(2))
	.reject(word => word.startsWith('-'))
	.map(path => glob.sync(path))
	.flatten()
	.forEach(path => {
		format(fs.readFileSync(path, 'utf-8'))
	})
	.value()

const outDir = _.chain(ps.argv.slice(2))
	.map((word, rank, list) => {
		if (word === '--outDir') {
			return list[rank + 1]
		}
	})
	.compact()
	.first()
	.value()
