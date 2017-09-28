const fs = require('fs')
const _ = require('lodash')

const createFormattingOptions = require('./createFormattingOptions')

let definition = fs.readFileSync('edge/index.d.ts', 'utf-8')

const lines = definition.split('\n')
const begin = _.findIndex(lines, line => line.startsWith('declare interface FormattingOptions {'))
const final = _.findIndex(lines, line => line === '}', begin + 1)

const formattingOptionDefinition = _.chain(createFormattingOptions.schema)
	.map((info, name) => '\t' + name + '?: ' + getType(info))
	.value()

definition = _.concat(
	lines.slice(0, begin + 1),
	formattingOptionDefinition,
	lines.slice(final)
).join('\n')

fs.writeFileSync('edge/index.d.ts', definition)

function getType(info) {
	if (info.type === 'integer') {
		return 'number'

	} else if (info.type === 'array') {
		return info.items.type + '[]'
		
	} else if (info.enum) {
		return _.chain(info.enum)
			.map(item => typeof item)
			.uniq()
			.value()
			.join(' | ')

	} else if (info.oneOf) {
		return _.chain(info.oneOf)
			.map(item => getType(item))
			.flatten()
			.uniq()
			.value()
			.join(' | ')

	} else {
		return info.type || 'any'
	}
}