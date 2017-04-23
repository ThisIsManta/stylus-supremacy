const fs = require('fs')
const _ = require('lodash')

const createFormattingOptions = require('./createFormattingOptions')
const format = require('./format')
const stylintOptions = require('stylint/src/core/config')

let document = fs.readFileSync('docs/index.html', 'utf-8')
document = updateFormattingOptions(document)
document = updateStylintCompatibility(document)
fs.writeFileSync('docs/index.html', document)

function updateFormattingOptions(originalText) {
	const placeholder = '<!-- formatting option placeholder -->'
	const originalList = originalText.split(placeholder)

	const defaultOptionJSON = (
		'<code>' +
		getCodeForHTML(JSON.stringify(createFormattingOptions({}), null, '  ')) +
		'</code>'
	)

	const optionDescriptionList = _.chain(createFormattingOptions.schema)
		.map((item, name) => [
			`<h2 id="options-${_.kebabCase(name)}"><mark>${name}</mark><data>= ${JSON.stringify(item.default)}</data><code>: ${getType(item)}</code></h2>`,
			item.description && item.description.split('\n').map(line => `<p>${line}</p>`).join(''),
			item.example && '<table>' + _.chunk(item.example.values, 2).map(values => {
				const createDefaultValueClassOrNothing = value => (value === item.default ? ' class="default"' : '')

				const headList = values.map(value =>
					'<th' + createDefaultValueClassOrNothing(value) + '>' +
					JSON.stringify(value) +
					'</th>'
				).join('')

				const codeList = values.map(value =>
					'<td' + createDefaultValueClassOrNothing(value) + '>' +
					getCodeForHTML(format(getCodeForFormatting(item.example.code), { [name]: value })) +
					'</td>'
				).join('')

				return `<thead><tr>${headList}</tr></thead><tbody><tr>${codeList}</tr></tbody>`
			}).join('') + '</table>'
		])
		.flatten()
		.compact()
		.join('')
		.value()

	return _.first(originalList) + placeholder + defaultOptionJSON + optionDescriptionList + placeholder + _.last(originalList)
}

function updateStylintCompatibility(originalText) {
	const placeholder = '<!-- stylint option placeholder -->'
	const originalList = originalText.split(placeholder)


	const formattingOptions = Object.keys(createFormattingOptions.schema)

	const stylintOptionText = fs.readFileSync('./edge/createFormattingOptionsFromStylint.js', 'utf-8').split(/\r?\n/)
	const startIndexForMap = _.findIndex(stylintOptionText, line => line.startsWith('const stylintOptionMap'))
	const endIndexForMap = _.findIndex(stylintOptionText, line => line.trim() === '}', startIndexForMap)
	if (startIndexForMap === -1 || endIndexForMap === -1 || startIndexForMap >= endIndexForMap) {
		throw new Error('Found an unexpected index of "stylintOptionMap": ' + startIndexForMap + ', ' + endIndexForMap)
	}

	const stylintOptionDict = stylintOptionText
		.slice(startIndexForMap + 1, endIndexForMap)
		.map(line => line.trim())
		.reduce((temp, line) => {
			const name = line.match(/'(\w+)\'/)[1]
			const list = formattingOptions
				.filter(item => line.includes('\'' + item + '\''))
				.map(item => `<mark>${item}</mark>`)
				.join(', ')
			const hint = line.includes('//')
				? (';' + line.substring(line.lastIndexOf('//') + 2))
				: ''

			temp[name] = list + hint
			return temp
		}, {})

	const optionConversionTable = _.map(stylintOptions, (item, name) => '<tr><td><mark>' + name + '</mark></td><td>' + _.get(stylintOptionDict, name, 'Not applicable') + '</td>').join('')

	return _.first(originalList) + placeholder + optionConversionTable + placeholder + _.last(originalList)
}

function getType(item) {
	if (_.isObject(item)) {
		if (item.type) {
			return item.type + (item.items ? ('&lt;' + getType(item.items) + '&gt;') : '')
		} else {
			return item.oneOf.map(getType).join(' | ')
		}
	} else {
		return JSON.stringify(item)
	}
}

function getCodeForFormatting(code) {
	let lines = code.split(/\r?\n/)

	while (lines[0].trim() === '') {
		lines.shift()
	}

	const indent = _.get(lines[0].match(/(\s|\t)+/g), '0', '')
	lines = lines.map(line => line.substring(indent.length))

	return lines.join('\n')
}

function getCodeForHTML(code) {
	return code
		.split(/\r?\n/)
		.map(line => line
			.replace(/^\t+/, s => '  '.repeat(s.length))
			.replace(/^\s+/, s => '&nbsp;'.repeat(s.length))
		)
		.join('<br>')
}
