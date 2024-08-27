const fs = require('fs')
const fp = require('path')
const ps = require('process')
const { globSync } = require('glob')
const JSON5 = require('json5')
const YAML = require('js-yaml')
const compact = require('lodash/compact')
const max = require('lodash/max')
const words = require('lodash/words')
const capitalize = require('lodash/capitalize')

const format = require('./format')
const createFormattingOptions = require('./createFormattingOptions')
const createFormattingOptionsFromStylint = require('./createFormattingOptionsFromStylint')
const checkIfFilePathIsIgnored = require('./checkIfFilePathIsIgnored')
const compareContent = require('./compareContent')

function process(command, params = [], Console = console) {
	if (command === '--version' || command === '-v') {
		Console.log('v' + require('../package.json').version)

	} else if (command === 'format') {
		const paramDefinitions = {
			optionFilePath: '--options|-p <path>',
			outputDirectoryPath: '--outDir|--out-dir|-o <path>',
			replacingOriginalFile: '--replace|-r',
			comparingOriginalContent: '--compare|-c',
			dryRun: '--dryRun|--dry-run',
			debugging: '--debug|-d',
			help: '--help|-h',
		}

		const {
			remainingParams,
			optionFilePath,
			outputDirectoryPath,
			replacingOriginalFile,
			comparingOriginalContent,
			dryRun,
			debugging,
			help,
		} = getParams(params, paramDefinitions)

		if (help) {
			const longestPatternLength = max(Object.values(paramDefinitions).map(pattern => pattern.length))

			Object.entries(paramDefinitions).forEach(([identifier, pattern]) => {
				const description = capitalize(words(identifier).join(' '))
				Console.log(pattern.padEnd(longestPatternLength), description)
			})

			return
		}

		if ([outputDirectoryPath, replacingOriginalFile, comparingOriginalContent].filter(param => !!param).length > 1) {
			throw new Error('Arguments --outDir, --replace and --compare could not co-exist.')
		}

		const inputFiles = remainingParams
			.flatMap(path => globSync(path))
		if (inputFiles.length === 0) {
			Console.log('No input files were found.')
		}

		let formattingOptions = {}
		if (optionFilePath) {
			if (fs.existsSync(optionFilePath) === false) {
				throw new Error('The given option file path did not exist.')
			}

			const fileText = fs.readFileSync(optionFilePath, 'utf8')
			if (/\.ya?ml$/.test(optionFilePath)) {
				try {
					formattingOptions = YAML.load(fileText, { json: true })
				} catch (ex) {
					throw new Error('The given option file could not be parsed as JSON.')
				}
			} else {
				try {
					formattingOptions = JSON5.parse(fileText)
				} catch (ex) {
					throw new Error('The given option file could not be parsed as YAML.')
				}
			}

			if (fp.basename(optionFilePath).startsWith('.stylintrc')) {
				formattingOptions = createFormattingOptionsFromStylint(formattingOptions)
			} else {
				formattingOptions = createFormattingOptions(formattingOptions)
			}
		}

		if (debugging) {
			Console.log(JSON.stringify(formattingOptions, null, '  '))
		}

		return compact(
			inputFiles
				.filter(path => !checkIfFilePathIsIgnored(path, ps.cwd(), formattingOptions))
				.map(path => {
					if (inputFiles.length > 1) {
						Console.log()
						Console.log('»', path)
					}

					try {
						const inputContent = fs.readFileSync(path, 'utf8')
						const outputContent = format(inputContent, formattingOptions)

						if (dryRun) {
							// Do nothing

						} else if (outputDirectoryPath) {
							if (fs.existsSync(fp.resolve(outputDirectoryPath)) === false) {
								fs.mkdirSync(fp.resolve(outputDirectoryPath))
							}

							fs.writeFileSync(fp.resolve(outputDirectoryPath, fp.basename(path)), outputContent)

						} else if (replacingOriginalFile) {
							if (inputContent !== outputContent) {
								fs.writeFileSync(path, outputContent)
							}

						} else if (comparingOriginalContent) {
							const error = compareContent(inputContent, outputContent)
							if (error) {
								Console.log(error)
								return error
							}

						} else {
							Console.log(outputContent)
						}

					} catch (error) {
						Console.log(error)
						return error
					}
				})
		)

	} else {
		throw new Error(`The command "${command}" was not recognized.`)
	}

	return []
}

function getParams(params, paramDefinitions) {
	const remainingParams = params.slice()
	const output = {}

	for (const identifier in paramDefinitions) {
		const pattern = paramDefinitions[identifier]
		const [option, interpolation] = pattern.split(' ')
		const matcher = new RegExp(`^(${option})$`)

		while (remainingParams.length > 0) {
			const index = remainingParams.findIndex(param => matcher.test(param))

			if (index === -1) {
				break
			}

			if (interpolation) {
				const value = params[index + 1]
				if (typeof value !== 'string' || value.startsWith('-')) {
					output[identifier] = null
					remainingParams.splice(index, 1)

				} else {
					output[identifier] = value
					remainingParams.splice(index, 2)
				}

			} else {
				output[identifier] = true
				remainingParams.splice(index, 1)
			}
		}

		if (output[identifier] === undefined) {
			output[identifier] = false
		}
	}

	return { ...output, remainingParams }
}

module.exports = process
