const fs = require('fs')
const pt = require('path')
const glob = require('glob')
const _ = require('lodash')

const format = require('./format')
const createFormattingOptions = require('./createFormattingOptions')
const createFormattingOptionsFromStylint = require('./createFormattingOptionsFromStylint')

function process(command, params = [], Console = console) {
	if (command === '--version' || command === '-v') {
		Console.log('v' + require('../package.json').version)

	} else if (command === 'format') {
		const optionFilePathParams = getParam(params, ['--options', '-p'], 1)
		const outputDirectoryParams = getParam(params, ['--outDir', '-o'], 1)
		const replaceOriginalParams = getParam(params, ['--replace', '-r'])
		const dryRunParams = getParam(params, ['--dryRun'])
		const debuggingParams = getParam(params, ['--debug', '-d'])

		const inputFiles = _.chain(params)
			.difference(optionFilePathParams, outputDirectoryParams, replaceOriginalParams)
			.map(path => glob.sync(path))
			.flatten()
			.value()
		if (inputFiles.length === 0) {
			Console.log('No input files found.')
		}

		let formattingOptions = {}
		if (optionFilePathParams.length > 0) {
			if (fs.existsSync(optionFilePathParams[1])) {
				formattingOptions = JSON.parse(fs.readFileSync(optionFilePathParams[1], 'utf8'))
				if (pt.basename(optionFilePathParams[1]).startsWith('.stylintrc')) {
					formattingOptions = createFormattingOptionsFromStylint(formattingOptions)
				} else {
					formattingOptions = createFormattingOptions(formattingOptions)
				}
			} else {
				throw new Error('Option file did not exist.')
			}
		}

		if (debuggingParams.length > 0) {
			Console.log(JSON.stringify(formattingOptions, null, '  '))
		}

		const errors = _.chain(inputFiles)
			.map(path => {
				if (inputFiles.length > 1) {
					Console.log()
					Console.log('»', path)
				}

				try {
					const inputContent = fs.readFileSync(path, 'utf8')
					const outputContent = format(inputContent, formattingOptions)

					if (dryRunParams.length > 0) {
						// Do nothing

					} else if (outputDirectoryParams.length > 0) {
						if (fs.existsSync(pt.resolve(outputDirectoryParams[1])) === false) {
							fs.mkdirSync(pt.resolve(outputDirectoryParams[1]))
						}

						fs.writeFileSync(pt.resolve(outputDirectoryParams[1], pt.basename(path)), outputContent)

					} else if (replaceOriginalParams.length > 0) {
						if (inputContent !== outputContent) {
							fs.writeFileSync(path, outputContent)
						}

					} else {
						Console.log(outputContent)
					}

				} catch (error) {
					Console.error(error)
				}
			})
			.compact()
			.value()

		if (errors.length > 0) {
			throw new Error(`Done with ${errors.length} error${errors.length === 1 ? '' : 's'}.`)
		}

	} else {
		throw new Error(`Command "${command}" was not recognized.`)
	}
}

function getParam(paramArray, names, nextValueCount = 0) {
	let paramIndex = -1
	while (++paramIndex < paramArray.length) {
		if (names.includes(paramArray[paramIndex])) {
			return [paramArray[paramIndex]].concat(paramArray.slice(paramIndex + 1).slice(0, nextValueCount))
		}
	}
	return []
}

module.exports = process
