const Jasmine = require('jasmine')
const jasmine = new Jasmine()

jasmine.loadConfig({
	helpers: ['../edge/format.js'],
	stopSpecOnExpectationFailure: false,
	random: false
})

jasmine.configureDefaultReporter({
	showColors: false
})

const { globSync } = require('glob')
const ps = require('process')
const fs = require('fs')
const pt = require('path')
const _ = require('lodash')
const Stylus = require('stylus')
const format = require('../edge/format')
const compareContent = require('../edge/compareContent')

const filesAndDirectories = _.chain(ps.argv.slice(2))
	.reject(para => para.startsWith('-'))
	.thru(list => list.length > 0 ? list : ['*'])
	.flatMap(para => globSync('spec/' + para))
	.filter(directory => fs.lstatSync(directory).isDirectory() && fs.readdirSync(directory).length > 0)
	.value()
const filesOnly = path => pt.extname(path) === '.js'
const directoriesOnly = path => pt.extname(path) === ''

const outputOverwritten = ps.argv.includes('-u')

filesAndDirectories.filter(directoriesOnly).forEach(directory => {
	const optionFilePath = pt.join(directory, 'formattingOptions.json')
	const inputFilePath = pt.join(directory, 'input.styl')
	const inputFormattedFilePath = pt.join(directory, 'input-formatted.styl')
	const inputDebuggingFilePath = pt.join(directory, 'input-debugging.json')
	const outputFilePath = pt.join(directory, 'output.styl')
	const outputFormattedFilePath = pt.join(directory, 'output-formatted.styl')
	const outputDebuggingFilePath = pt.join(directory, 'output-debugging.json')

	const inputContent = fs.readFileSync(inputFilePath, 'utf8')

	let formattingOptions = undefined
	if (fs.existsSync(optionFilePath)) {
		formattingOptions = require('../' + optionFilePath)
	}

	if (fs.existsSync(outputFilePath) === false || outputOverwritten) {
		const actualContent = format(inputContent, formattingOptions)
		fs.writeFileSync(outputFilePath, actualContent)
	}

	const outputContent = fs.readFileSync(outputFilePath, 'utf8')

	const testSpecName = pt.basename(directory)
	describe(testSpecName, () => {
		it('can be formatted', () => {
			if (fs.existsSync(inputFormattedFilePath)) {
				fs.unlinkSync(inputFormattedFilePath)
			}

			try {
				const tree = new Stylus.Parser(inputContent).parse()
				fs.writeFileSync(inputDebuggingFilePath, JSON.stringify(tree, null, '\t'))
			} catch (ex) {
				// Do nothing
			}

			const actualContent = format(inputContent, formattingOptions)

			const errorMessage = compareContent(actualContent, outputContent)
			if (errorMessage) {
				fs.writeFileSync(inputFormattedFilePath, actualContent)

				const stack = [
					inputFilePath,
					inputFormattedFilePath,
					inputDebuggingFilePath,
					outputFilePath,
				].map(path => pt.resolve(path)).join('\n')

				fail({
					message: errorMessage,
					stack,
				})
			} else {
				expect(true).toBeTruthy()
			}
		})

		// Skip output parsing for partial content
		if (testSpecName.includes('option-wrap-mode')) {
			return null
		}

		it('can be re-parsed', () => {
			try {
				new Stylus.Parser(outputContent).parse()
			} catch (ex) {
				fail(ex)
			}
		})

		it('can be re-formatted', () => {
			const actualContent = format(outputContent, formattingOptions)

			try {
				const tree = new Stylus.Parser(outputContent).parse()
				fs.writeFileSync(outputDebuggingFilePath, JSON.stringify(tree, null, '\t'))
			} catch (ex) {
				// Do nothing
			}

			const errorMessage = compareContent(actualContent, outputContent)
			if (errorMessage) {
				fs.writeFileSync(outputFormattedFilePath, actualContent)

				const stack = [
					outputFilePath,
					outputFormattedFilePath,
					outputDebuggingFilePath,
				].map(path => pt.resolve(path)).join('\n')

				fail({
					message: errorMessage,
					stack,
				})
			} else {
				expect(true).toBeTruthy()
			}
		})
	})
})

filesAndDirectories.filter(filesOnly).forEach(path => {
	require('../' + path)
})

jasmine.execute()