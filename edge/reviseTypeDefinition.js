const fs = require('fs')
const findIndex = require('lodash/findIndex')
const uniq = require('lodash/uniq')

const schema = require('./schema')

const filePath = 'edge/index.d.ts'
let content = fs.readFileSync(filePath, 'utf-8')

const lines = content.split('\n')
const begin = findIndex(lines, line => line === '\texport interface FormattingOptions {')
const final = findIndex(lines, line => line === '\t}', begin + 1)

if (begin === -1 || final === -1) {
	throw new Error(`Could not find "FormattingOptions" interface in ${filePath}.`)
}

const formattingOptionDefinition = Object.entries(schema)
	.map(([name, info]) => '\t\t' + name + '?: ' + getType(info))

content = [
	...lines.slice(0, begin + 1),
	...formattingOptionDefinition,
	...lines.slice(final),
].join('\n')

fs.writeFileSync(filePath, content)

function getType(info) {
	if (info.type === 'integer') {
		return 'number'

	} else if (info.type === 'array') {
		return info.items.type + '[]'

	} else if (info.enum) {
		return uniq(info.enum.map(item => typeof item)).join(' | ')

	} else if (info.oneOf) {
		return uniq(info.oneOf.flatMap(item => getType(item))).join(' | ')

	} else {
		return info.type || 'any'
	}
}