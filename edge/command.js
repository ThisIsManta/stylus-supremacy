#!/usr/bin/env node

const ps = require('process')
const fs = require('fs')
const pt = require('path')
const glob = require('glob')
const _ = require('lodash')

const format = require('./format')
const createFormattingOptions = require('./createFormattingOptions')
const createFormattingOptionsFromStylint = require('./createFormattingOptionsFromStylint')

function process(command, params) {
	if (command === '--version' || command === '-v') {
		console.log('v' + require('../package.json').version)

	} else if (command === 'format') {
		const optionFilePathParams = getParam(params, ['--options', '-p'], 1)
		const outputDirectoryParams = getParam(params, ['--outDir', '-o'], 1)
		const replaceOriginalParams = getParam(params, ['--replace', '-r'])
		const debuggingParams = getParam(params, ['--debug', '-d'])

		const inputFiles = _.chain(params)
			.difference(optionFilePathParams, outputDirectoryParams, replaceOriginalParams)
			.map(path => glob.sync(path))
			.flatten()
			.value()
		if (inputFiles.length === 0) {
			console.log('No input files found.')
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

		if (debuggingParams.length > 0 && _.isEmpty(formattingOptions) === false) {
			console.log(JSON.stringify(formattingOptions, null, '  '))
		}

		const errorCount = _.chain(inputFiles)
			.map(path => {
				if (inputFiles.length > 1) {
					console.log()
					console.log('»', path)
				}

				try {
					const inputContent = fs.readFileSync(path, 'utf8')
					const outputContent = format(inputContent, formattingOptions)

					if (outputDirectoryParams.length > 0) {
						if (fs.existsSync(pt.resolve(outputDirectoryParams[1])) === false) {
							fs.mkdirSync(pt.resolve(outputDirectoryParams[1]))
						}

						fs.writeFileSync(pt.resolve(outputDirectoryParams[1], pt.basename(path)), outputContent)

					} else if (replaceOriginalParams.length > 0) {
						if (inputContent !== outputContent) {
							fs.writeFileSync(path, outputContent)
						}

					} else {
						console.log(outputContent)
					}
					return 0

				} catch (error) {
					if (error.stack) {
						console.error(error.stack)
					} else {
						console.error(error.name + ': ' + error.message)
					}
					return 1
				}
			})
			.sum()
			.value()

		if (errorCount > 0) {
			console.log()
			console.log(`Done with ${errorCount} error${errorCount === 1 ? '' : 's'}.`)
			ps.exit(1)
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

process(ps.argv[2], ps.argv.slice(3))
