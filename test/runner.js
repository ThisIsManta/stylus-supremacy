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

const glob = require('glob')
const ps = require('process')
const fs = require('fs')
const pt = require('path')
const _ = require('lodash')
const Stylus = require('stylus')
const format = require('../edge/format')

const filesAndDirectories = _.chain(ps.argv.length > 2 ? ps.argv.slice(2) : ['*']).map(para => glob.sync('spec/' + para)).flatten().value()
const filesOnly = path => pt.extname(path) === '.js'
const directoriesOnly = path => pt.extname(path) === ''
const createComparableLines = text => text.replace(/\r/g, '¶').replace(/\t/g, '→').replace(/^\s+/gm, spaces => _.repeat('·', spaces.length)).split('\n')
const createComparisonTest = (actualContent, expectContent, stack) => {
	const resultLines = createComparableLines(actualContent)
	const expectLines = createComparableLines(expectContent)

	let lineIndex = -1
	const lineLimit = Math.min(resultLines.length, expectLines.length)
	while (++lineIndex < Math.min(resultLines.length, expectLines.length)) {
		if (resultLines[lineIndex] !== expectLines[lineIndex]) {
			let diffs = ''
			let charIndex = -1
			const charLimit = Math.max(resultLines[lineIndex].length, expectLines[lineIndex].length)
			while (++charIndex < charLimit) {
				if (resultLines[lineIndex][charIndex] !== expectLines[lineIndex][charIndex]) {
					diffs += '^'
				} else {
					diffs += ' '
				}
			}

			return fail({
				message: [
					'The first mismatched was at line ' + (lineIndex + 1) + '.',
					'  Actual: ' + resultLines[lineIndex],
					'  Expect: ' + expectLines[lineIndex],
					'          ' + diffs
				].join('\n'),
				stack
			})
		}
	}

	return fail({
		message: 'It was not clear to show the difference. Please check out the files below.',
		stack
	})
}

filesAndDirectories.filter(directoriesOnly).forEach(directory => {
	const optionFilePath = pt.join(directory, 'formattingOptions.json')
	const inputFilePath = pt.join(directory, 'input.styl')
	const inputFormattedFilePath = pt.join(directory, 'input-formatted.styl')
	const inputDebuggingFilePath = pt.join(directory, 'input-debugging.json')
	const outputFilePath = pt.join(directory, 'output.styl')
	const outputFormattedFilePath = pt.join(directory, 'output-formatted.styl')
	const outputDebuggingFilePath = pt.join(directory, 'output-debugging.json')

	const inputContent = fs.readFileSync(inputFilePath, 'utf8')
	const outputContent = fs.readFileSync(outputFilePath, 'utf8')

	let formattingOptions = null
	if (fs.existsSync(optionFilePath)) {
		formattingOptions = require('../' + optionFilePath)
	}

	const testSpecName = pt.basename(directory)
	describe(testSpecName, () => {
		it('can be formatted', () => {
			if (fs.existsSync(inputFormattedFilePath)) fs.unlinkSync(inputFormattedFilePath)

			try {
				const tree = new Stylus.Parser(inputContent).parse()
				fs.writeFileSync(inputDebuggingFilePath, JSON.stringify(tree, null, '\t'))
			} catch (ex) {
				// Do nothing
			}

			const actualContent = format(inputContent, formattingOptions)

			if (actualContent === outputContent) {
				expect(true).toBeTruthy()

			} else {
				fs.writeFileSync(inputFormattedFilePath, actualContent)

				const stack = [
					inputFilePath,
					inputFormattedFilePath,
					inputDebuggingFilePath,
					outputFilePath,
				].map(path => pt.resolve(path)).join('\n')

				createComparisonTest(actualContent, outputContent, stack)
			}
		})

		// Skip output parsing for partial content
		if (testSpecName.includes('option-wrap-mode')) {
			return null
		}

		/* xit('can be re-parsed', () => {
			try {
				new Stylus.Parser(outputContent).parse()
			} catch (ex) {
				fail(ex)
			}
		}) */

		it('can be re-formatted', () => {
			const actualContent = format(outputContent, formattingOptions)

			try {
				const tree = new Stylus.Parser(outputContent).parse()
				fs.writeFileSync(outputDebuggingFilePath, JSON.stringify(tree, null, '\t'))
			} catch (ex) {
				// Do nothing
			}

			if (actualContent === outputContent) {
				expect(true).toBeTruthy()

			} else {
				fs.writeFileSync(outputFormattedFilePath, actualContent)

				stack = [
					outputFilePath,
					outputFormattedFilePath,
					outputDebuggingFilePath,
				].map(path => pt.resolve(path)).join('\n')

				createComparisonTest(actualContent, outputContent, stack)
			}
		})
	})
})

filesAndDirectories.filter(filesOnly).forEach(path => {
	require('../' + path)
})

jasmine.execute()