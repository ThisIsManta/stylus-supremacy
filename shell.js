const ps = require('process')
const fs = require('fs')
const glob = require('glob')
const _ = require('lodash')
const { format } = require('./index.js')

const files = _.chain(ps.argv.slice(2))
	.reject(word => word.startsWith('-'))
	.map(path => glob.sync(path))
	.flatten()
	.forEach(path => {
		const formattedContent = format(fs.readFileSync(path, 'utf-8'))
		console.log('===')
		console.log(formattedContent)
		// TODO: write back
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
