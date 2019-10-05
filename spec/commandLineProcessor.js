const fs = require('fs')

const process = require('../edge/commandLineProcessor')
const createCodeForFormatting = require('../edge/createCodeForFormatting')

const inputTempFile = '__commandLineProcessorInput.styl'
const optionTempFileJSON = '__formattingOptions.json'
const optionTempFileYAML = '__formattingOptions.yaml'
const outputTempFile = '__commandLineProcessorOutput.styl'

describe('commandLineProcessor', () => {
	let Console

	beforeEach(() => {
		Console = {
			_log: [],
			log(...data) {
				this._log.push(data)
			},
			_error: [],
			error(...data) {
				this._error.push(data)
			},
		}
	})

	afterEach(() => {
		if (fs.existsSync(inputTempFile)) {
			fs.unlinkSync(inputTempFile)
		}

		if (fs.existsSync(optionTempFileJSON)) {
			fs.unlinkSync(optionTempFileJSON)
		}

		if (fs.existsSync(optionTempFileYAML)) {
			fs.unlinkSync(optionTempFileYAML)
		}

		if (fs.existsSync(outputTempFile)) {
			fs.unlinkSync(outputTempFile)
		}
	})

	;['--version'].forEach(param => {
		it('prints the current version number', () => {
			process(param, [], Console)
			expect(Console._log[0]).toEqual([jasmine.stringMatching(/v\d+\.\d+\.\d+/)]);
		})
	})

	it('prints the formatted content, given no formatting options', () => {
		const inputContent = createCodeForFormatting(`
		body
		  display none
		`)

		const expectContent = createCodeForFormatting(`
		body {
			display: none;
		}
		`)

		fs.writeFileSync(inputTempFile, inputContent)
		process('format', [inputTempFile], Console)
		const outputContent = Console._log[0][0]

		expect(outputContent).toBe(expectContent)
	})

	;['--options', '-p'].forEach(param => {
		it('prints the formatted content, given the formatting options in JSON', () => {
			const inputContent = createCodeForFormatting(`
			body
			  display none
			`)

			const formattingOptions = `{
				// Comments are acceptable because parsing JSON is done by https://www.npmjs.com/package/json5
				"insertColons": false
			}`

			const expectContent = createCodeForFormatting(`
			body {
				display none;
			}
			`)

			fs.writeFileSync(inputTempFile, inputContent)
			fs.writeFileSync(optionTempFileJSON, formattingOptions)
			process('format', [inputTempFile, param, optionTempFileJSON], Console)
			const outputContent = Console._log[0][0]

			expect(outputContent).toBe(expectContent)
		})
	})

	;['--options', '-p'].forEach(param => {
		it('prints the formatted content, given the formatting options in YAML', () => {
			const inputContent = createCodeForFormatting(`
			body
			  display none
			`)

			const formattingOptions = 'insertColons: false'

			const expectContent = createCodeForFormatting(`
			body {
				display none;
			}
			`)

			fs.writeFileSync(inputTempFile, inputContent)
			fs.writeFileSync(optionTempFileYAML, formattingOptions)
			process('format', [inputTempFile, param, optionTempFileYAML], Console)
			const outputContent = Console._log[0][0]

			expect(outputContent).toBe(expectContent)
		})
	})

	;['--outDir', '-o'].forEach(param => {
		it('writes the formatted content into the given output directory', () => {
			const inputContent = createCodeForFormatting(`
			body
			  display none
			`)

			const expectContent = createCodeForFormatting(`
			body {
				display: none;
			}
			`)

			fs.writeFileSync(inputTempFile, inputContent)
			process('format', [inputTempFile, param, 'temp'], Console)
			const outputContent = fs.readFileSync('temp/' + inputTempFile, 'utf-8')
			fs.unlinkSync('temp/' + inputTempFile)

			expect(outputContent).toBe(expectContent)
		})
	})

	;['--replace', '-r'].forEach(param => {
		it('writes the formatted content into the given output directory', () => {
			const inputContent = createCodeForFormatting(`
			body
			  display none
			`)

			const expectContent = createCodeForFormatting(`
			body {
				display: none;
			}
			`)

			fs.writeFileSync(inputTempFile, inputContent)
			process('format', [inputTempFile, param], Console)
			const outputContent = fs.readFileSync(inputTempFile, 'utf-8')

			expect(outputContent).toBe(expectContent)
		})
	})

	;['--compare', '-c'].forEach(param => {
		it('prints no errors, given a well-formatted content', () => {
			const inputContent = createCodeForFormatting(`
			body {
				display: none;
			}
			`)

			fs.writeFileSync(inputTempFile, inputContent)
			const errors = process('format', [inputTempFile, param], Console)

			expect(errors.length).toBe(0)
		})

		it('prints the difference between the input and the formatted content', () => {
			const inputContent = createCodeForFormatting(`
			body {
				display none
			}
			`)

			fs.writeFileSync(inputTempFile, inputContent)
			const errors = process('format', [inputTempFile, param], Console)

			expect(errors[0]).toEqual([
				'The first mismatched was at line 2.',
				'  Actual: →display none',
				'  Expect: →display: none;',
				'                  ^^^^^^^',
			].join('\n'))
		})
	})

	it('throws an error given an unknown command', () => {
		expect(() => { process('unknown', [], Console) }).toThrow()
	})
})
