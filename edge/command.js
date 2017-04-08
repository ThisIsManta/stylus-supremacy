#!/usr/bin/env node

const ps = require('process')
const fs = require('fs')
const pt = require('path')
const glob = require('glob')
const _ = require('lodash')
const { format } = require('./format.js')

let inputFiles = []
let optionFilePath = ''
let replaceOriginal = false
let outputDirectory = ''

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

	} else {
		inputFiles.push(param)
	}
}

if (inputFiles.length === 0) {
	console.log('No files specified.')

} else {
	const formattingOptions = optionFilePath && fs.existsSync(optionFilePath) ? require(optionFilePath) : null

	const outputFiles = _.chain(inputFiles)
		.map(path => glob.sync(path))
		.flatten()
		.map(path => Object.assign({ path }, format(fs.readFileSync(path, 'utf8'), formattingOptions)))
		.value()

	if (outputDirectory) {
		if (fs.existsSync(pt.resolve(outputDirectory)) === false) {
			fs.mkdirSync(pt.resolve(outputDirectory))
		}
		outputFiles.forEach(file => {
			fs.writeFileSync(pt.resolve(outputDirectory, pt.basename(file.path)), file.text)
		})

	} else if (replaceOriginal) {
		outputFiles.forEach(file => {
			fs.writeFileSync(file.path, file.text)
		})

	} else {
		outputFiles.forEach(file => {
			console.log(file.text)
		})
	}

	if (outputFiles.some(file => file.warnings.length > 0)) {
		outputFiles.forEach(file => {
			file.warnings.forEach(warn => {
				console.log(`WARN: ${warn.message} in ${file.path}`)
				if (warn.data !== undefined) {
					console.log(JSON.stringify(warn.data, null, '\t'))
				}
			})
		})
		const warningCount = _.sumBy(outputFiles, file => file.warnings.length)
		console.log(`Done with ${warningCount} warning${warningCount === 1 ? '' : 's'}.`)

	} else {
		console.log('Done without warnings.')
	}
}