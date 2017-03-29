const ps = require('process')
const fs = require('fs')
const pt = require('path')
const glob = require('glob')
const _ = require('lodash')
const { format } = require('./format.js')

const isDebugging = _.chain(ps.argv.slice(2)).find(word => word === '--debug' || word === '-d').value()

const optionPath = _.chain(ps.argv.slice(2)).map((word, rank, list) => { if (word === '--options' || word === '-p') return list[rank + 1] }).compact().first().value()

const formattingOptions = optionPath && fs.existsSync(optionPath) ? require(optionPath) : null

const files = _.chain(ps.argv.slice(2))
	.reject(word => word.startsWith('-'))
	.map(path => glob.sync(path))
	.flatten()
	.map(path => Object.assign({ path }, format(fs.readFileSync(path, 'utf-8'), formattingOptions, !!isDebugging)))
	.value()

const replaceOriginal = _.chain(ps.argv.slice(2)).find(word => word === '--replace' || word === '-r').value()

const outputDirectory = _.chain(ps.argv.slice(2)).map((word, rank, list) => { if (word === '--outDir' || word === '-o') return list[rank + 1] }).compact().first().value()

if (outputDirectory) {
	if (fs.existsSync(pt.resolve(outputDirectory)) === false) {
		fs.mkdirSync(pt.resolve(outputDirectory))
	}
	files.forEach(file => {
		fs.writeFileSync(pt.resolve(outputDirectory, pt.basename(file.path)), file.content)
	})

} else if (replaceOriginal) {
	files.forEach(file => {
		fs.writeFileSync(file.path, file.content)
	})

} else {
	files.forEach(file => {
		console.log(file.content)
	})
}

if (files.some(file => file.warnings.length > 0)) {
	files.forEach(file => {
		file.warnings.forEach(warn => {
			console.log(`WARN: ${warn.message} in ${file.path}`)
			if (warn.data !== undefined) {
				console.log(JSON.stringify(warn.data, null, '\t'))
			}
		})
	})
	const warningCount = _.sumBy(files, file => file.warnings.length)
	console.log(`Done with ${warningCount} warning${warningCount === 1 ? '' : 's'}.`)

} else {
	console.log('Done without warnings.')
}