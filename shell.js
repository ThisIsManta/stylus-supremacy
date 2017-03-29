const ps = require('process')
const fs = require('fs')
const glob = require('glob')
const _ = require('lodash')
const { format } = require('./index.js')

const optionPath = _.chain(ps.argv.slice(2)).map((word, rank, list) => { if (word === '--options' || word === '-p') return list[rank + 1] }).compact().first().value()

const formattingOptions = optionPath && fs.existsSync(optionPath) ? require(optionPath) : null

const files = _.chain(ps.argv.slice(2))
	.reject(word => word.startsWith('-'))
	.map(path => glob.sync(path))
	.flatten()
	.map(path => ({ path, content: format(fs.readFileSync(path, 'utf-8'), formattingOptions) }))
	.value()

const replaceOriginal = _.chain(ps.argv.slice(2)).find(word => word === '--replace' || word === '-r').value()

const outputDirectory = _.chain(ps.argv.slice(2)).map((word, rank, list) => { if (word === '--outDir' || word === '-o') return list[rank + 1] }).compact().first().value()

if (outputDirectory) {
	console.log('a')
} else if (replaceOriginal) {
	console.log('b', replaceOriginal)
} else {
	files.forEach(file => {
		console.log(file.path)
		console.log('x'+file.content)
	})
}