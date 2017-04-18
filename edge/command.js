#!/usr/bin/env node

const ps = require('process')
const fs = require('fs')
const pt = require('path')
const glob = require('glob')
const _ = require('lodash')
const format = require('./format')

let inputFiles = []
let optionFilePath = ''
let replaceOriginal = false
let outputDirectory = ''
let printVersion = false

let paramIndex = -1
const paramArray = ps.argv.slice(2)
while (++paramIndex < paramArray.length) {
	const param = paramArray[paramIndex]

	if (param === '--options' || param === '-p') {
		optionFilePath = paramArray[paramIndex + 1]
		paramIndex++

	} else if (param === '--replace' || param === '-r') {
		replaceOriginal = true

	} else if (param === '--outDir' || param === '-o') {
		outputDirectory = paramArray[paramIndex + 1]
		paramIndex++

	} else if (param === '--version' || param === '-v') {
		printVersion = true

	} else {
		inputFiles.push(param)
	}
}

if (printVersion) {
	console.log('v' + require('../package.json').version)

} else if (inputFiles.length === 0) {
	console.log('No input files specified.')

} else {
	let formattingOptions = null
	if (optionFilePath) {
		if (fs.existsSync(optionFilePath)) {
			formattingOptions = JSON.parse(fs.readFileSync(optionFilePath, 'utf8'))
		} else {
			throw new Error('Option file could not be found.')
		}
	}

	const errorCount = _.chain(inputFiles)
		.map(path => glob.sync(path))
		.flatten()
		.map(path => {
			console.log()
			console.log('»', path)

			try {
				const inputContent = fs.readFileSync(path, 'utf8')
				const outputContent = format(inputContent, formattingOptions)

				if (outputDirectory) {
					if (fs.existsSync(pt.resolve(outputDirectory)) === false) {
						fs.mkdirSync(pt.resolve(outputDirectory))
					}

					fs.writeFileSync(pt.resolve(outputDirectory, pt.basename(path)), outputContent)

				} else if (replaceOriginal) {
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

	console.log()

	if (errorCount === 0) {
		console.log('Done without errors.')
	} else {
		console.log(`Done with ${errorCount} error${errorCount === 1 ? '' : 's'}.`)
		ps.exit(1)
	}
}