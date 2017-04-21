const fs = require('fs')
const _ = require('lodash')

const schema = require('./formattingOptionSchema.json')
const stylintOptions = require('stylint/src/core/config')

let document = fs.readFileSync('README.md', 'utf-8')
document = updateFormattingOptions(document)
document = updateStylintCompatibility(document)
fs.writeFileSync('README2.md', document)

function updateFormattingOptions(originalText) {
	const originalLines = originalText.split(/\r?\n/)

	const startIndex = _.findIndex(originalLines, line => line.startsWith('###'), originalLines.indexOf('## Formatting options'))
	const endIndex = _.findIndex(originalLines, line => line.startsWith('## '), startIndex)
	if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
		throw new Error('Found an unexpected index of "Formatting options": ' + startIndex + ', ' + endIndex)
	}

	const modifiedLines = _.map(schema, (item, name) => [
		'### **`' + name + '`**`: ' + getType(item) + ' = ' + JSON.stringify(item.default) + '`',
		item.description,
		item.examples || [],
		''
	])

	return _.flattenDeep([
		originalLines.slice(0, startIndex),
		modifiedLines,
		originalLines.slice(endIndex)
	]).join('\r\n')
}

function updateStylintCompatibility(originalText) {
	const originalLines = originalText.split(/\r?\n/)

	const startIndex = _.findIndex(originalLines, line => line.startsWith('|Stylint options|'), originalLines.indexOf('## Stylint compatibility'))
	const endIndex = _.findIndex(originalLines, line => line.startsWith('|') === false, startIndex)
	if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
		throw new Error('Found an unexpected index of "Stylint compatibility": ' + startIndex + ', ' + endIndex)
	}

	const formattingOptions = Object.keys(schema)

	const stylintOptionText = fs.readFileSync('./edge/createFormattingOptionsFromStylint.js', 'utf-8').split(/\r?\n/)
	const startIndexForMap = _.findIndex(stylintOptionText, line => line.startsWith('const stylintOptionMap'))
	const endIndexForMap = _.findIndex(stylintOptionText, line => line.trim() === '}', startIndexForMap)
	if (startIndexForMap === -1 || endIndexForMap === -1 || startIndexForMap >= endIndexForMap) {
		throw new Error('Found an unexpected index of "stylintOptionMap": ' + startIndexForMap + ', ' + endIndexForMap)
	}
	const stylintOptionDict = stylintOptionText.slice(startIndexForMap + 1, endIndexForMap).map(line => line.trim()).reduce((temp, line) => {
		const name = line.match(/'(\w+)\'/)[1]
		const list = formattingOptions.filter(item => line.includes('\'' + item + '\'')).map(item => '`' + item + '`').join(', ')
		const hint = line.includes('//') ? (';' + line.substring(line.lastIndexOf('//') + 2)) : ''
		temp[name] = list + hint
		return temp
	}, {})
	console.log(stylintOptionDict)

	const modifiedLines = _.map(stylintOptions, (item, name) => '|`' + name + '`|' + _.get(stylintOptionDict, name, 'Not applicable') + '|')
	/*console.log([
		originalLines.slice(0, startIndex + 1),
		modifiedLines,
		originalLines.slice(endIndex)
	])*/

	return _.flattenDeep([
		originalLines.slice(0, startIndex + 1),
		modifiedLines,
		originalLines.slice(endIndex)
	]).join('\r\n')
}

function getType(item) {
	if (_.isObject(item)) {
		if (item.type) {
			return item.type + (item.items ? ('<' + getType(item.items) + '>') : '')
		} else {
			return item.oneOf.map(getType).join(' | ')
		}
	} else {
		return JSON.stringify(item)
	}
}
