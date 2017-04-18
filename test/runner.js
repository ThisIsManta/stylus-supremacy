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

const filteredSpecName = _.chain(ps.argv).map((param, index, array) => (param === '--filter' || param === '-f') ? _.trim(array[index + 1], '"') : null).compact().first().value()

const filesAndDirectories = glob.sync('spec/' + (filteredSpecName || '*'))
const filesOnly = path => pt.extname(path) === '.js'
const directoriesOnly = path => pt.extname(path) === ''
const createComparableLines = text => text.replace(/\r/g, '¶').replace(/\t/g, '→').replace(/^\s+/gm, spaces => _.repeat('·', spaces.length)).split('\n')

filesAndDirectories.filter(directoriesOnly).forEach(directory => {
	const inputFilePath = pt.join(directory, 'input.styl')
	const optionFilePath = pt.join(directory, 'formattingOptions.json')
	const outputFilePath = pt.join(directory, 'output.styl')
	const actualFilePath = pt.join(directory, 'actual.styl')
	const debuggingFilePath = pt.join(directory, 'debugging.json')

	const inputContent = fs.readFileSync(inputFilePath, 'utf8')
	const outputContent = fs.readFileSync(outputFilePath, 'utf8')

	let formattingOptions = null
	if (fs.existsSync(optionFilePath)) {
		formattingOptions = require('../' + optionFilePath)
	}

	describe(pt.basename(directory), () => {
		it('', () => {
			if (fs.existsSync(actualFilePath)) fs.unlinkSync(actualFilePath)
			if (fs.existsSync(debuggingFilePath)) fs.unlinkSync(debuggingFilePath)

			const actualContent = format(inputContent, formattingOptions)

			if (actualContent === outputContent) { // In case of success
				expect(true).toBeTruthy()

			} else { // In case of failure
				fs.writeFileSync(actualFilePath, actualContent)

				try {
					const tree = new Stylus.Parser(modifiedContent).parse()
					fs.writeFileSync(debuggingFilePath, JSON.stringify(tree, null, '\t'))
				} catch (ex) {
					// Do nothing
				}

				const stack = [
					inputFilePath,
					actualFilePath,
					outputFilePath,
					debuggingFilePath
				].map(path => pt.resolve(path)).join('\n')

				const resultLines = createComparableLines(actualContent)
				const expectLines = createComparableLines(outputContent)

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
		})
	})
})

filesAndDirectories.filter(filesOnly).forEach(path => {
	require('../' + path)
})

jasmine.execute()