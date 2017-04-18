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
	throw new Error('No input files specified.')

} else {
	let formattingOptions = null
	if (optionFilePath) {
		if (fs.existsSync(optionFilePath)) {
			formattingOptions = JSON.parse(fs.readFileSync(optionFilePath, 'utf8'))
		} else {
			throw new Error('Option file could not be found.')
		}
	}

	_.chain(inputFiles)
		.map(path => glob.sync(path))
		.flatten()
		.forEach(path => {
			console.log('Processing ', path)

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

			} catch (error) {
				console.log(error)
			}
		})
		.value()

	console.log('Done.')
}