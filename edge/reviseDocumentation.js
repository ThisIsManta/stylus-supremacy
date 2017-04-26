const fs = require('fs')
const _ = require('lodash')

const createFormattingOptions = require('./createFormattingOptions')
const format = require('./format')
const stylintOptions = require('stylint/src/core/config')

let document = fs.readFileSync('docs/index.html', 'utf-8')
document = updateDocument(document, '<!-- formatting toggler placeholder -->', createFormattingTogglersForDemo)
document = updateDocument(document, '<!-- formatting option placeholder -->', createFormattingDescription)
document = updateDocument(document, '<!-- stylint option placeholder -->', createStylintConversionTable)

fs.writeFileSync('docs/index.html', document)

function updateDocument(document, placeholder, worker) {
	const chunks = document.split(placeholder)
	const output = worker()
	return _.first(chunks) + placeholder + output + placeholder + _.last(chunks)
}

function createFormattingTogglersForDemo() {
	return _.chain(createFormattingOptions.schema)
		.omitBy(item => item.hideInDemo === true)
		.map((item, name) => {
			if (item.type === 'boolean') {
				return (
					`<label for="demo-${name}">` +
					`<span>${name}</span>` +
					`<input id="demo-${name}" type="checkbox" ${item.default === true ? 'checked' : ''}>` +
					`</label>`
				)

			} else if (item.type === 'string') {
				return (
					`<label for="demo-${name}">` +
					`<span>${name}</span>` +
					`<input id="demo-${name}" type="text" value="${getType(item.default)}" required>` +
					`</label>`
				)

			} else if (item.type === 'integer') {
				return (
					`<label for="demo-${name}">` +
					`<span>${name}</span>` +
					`<input id="demo-${name}" type="number" ${item.minimum !== undefined ? `min="${item.minimum}"` : ''} ${item.maximum !== undefined ? `max="${item.maximum}"` : ''} value="${item.default}">` +
					`</label>`
				)

			} else if (_.some(item.oneOf)) {
				return (
					`<label for="demo-${name}">` +
					`<span>${name}</span>` +
					`<select id="demo-${name}" value="${getType(item.default)}">` +
					item.oneOf.map(stub => `<option value="${getType(stub)}" ${_.isObject(stub) ? 'disabled' : ''}>${getType(stub)}</option>`) +
					`</select>` +
					`</label>`
				)
			}
		})
		.compact()
		.join('')
		.value()
}

function createFormattingDescription() {
	const defaultOptionJSON = (
		'<code>' +
		getCodeForHTML(JSON.stringify(createFormattingOptions({}), null, '  ')) +
		'</code>'
	)

	const formattingOptionDescription = _.chain(createFormattingOptions.schema)
		.map((item, name) => [
			`<h2 id="option-${_.kebabCase(name)}">`,
			`<mark>${name}</mark>`,
			`<wbr>`,
			`<data>${getNonBreakableForFirstWord('= ', JSON.stringify(item.default))}</data>`,
			`<wbr>`,
			`<code>${getNonBreakableForFirstWord(': ', getType(item))}</code>`,
			`</h2>`,
			item.description && item.description.split('\n').map(line => `<p>${line}</p>`).join(''),
			item.hideInVSCE ? '<p>This option is not available in the Visual Studio Code extension.</p>' : '',
			item.example && '<table>' + _.chunk(item.example.values, 2).map(values => {
				const headList = values.map(value =>
					'<th>' +
					JSON.stringify(value) +
					'</th>'
				).join('')

				const codeList = values.map(value =>
					'<td>' +
					getCodeForHTML(format(getCodeForFormatting(item.example.code), { [name]: value })) +
					'</td>'
				).join('')

				return (
					`<thead><tr>${headList}</tr></thead>` +
					`<tbody><tr>${codeList}</tr></tbody>`
				)
			}).join('') + '</table>'
		])
		.flatten()
		.compact()
		.join('')
		.value()

	return defaultOptionJSON + formattingOptionDescription
}

function createStylintConversionTable() {
	const formattingOptions = Object.keys(createFormattingOptions.schema)

	const stylintOptionText = fs.readFileSync('./edge/createFormattingOptionsFromStylint.js', 'utf-8').split(/\r?\n/)
	const startIndex = _.findIndex(stylintOptionText, line => line.startsWith('const stylintOptionMap'))
	const endIndex = _.findIndex(stylintOptionText, line => line.trim() === '}', startIndex)
	if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
		throw new Error('Found an unexpected index of "stylintOptionMap": ' + startIndex + ', ' + endIndex)
	}

	const stylintOptionDict = stylintOptionText
		.slice(startIndex + 1, endIndex)
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

	return _.map(stylintOptions, (item, name) =>
		'<tr><td><mark class="alt">' + name + '</mark></td><td>' +
		_.get(stylintOptionDict, name, 'Not applicable') + '</td>'
	).join('')
}

function getType(item) {
	if (_.isObject(item)) {
		if (item.type) {
			return item.type + (item.items ? ('&lt;' + getType(item.items) + '&gt;') : '')
		} else {
			return item.oneOf.map(getType).join(' | ')
		}
	} else {
		return _.escape(JSON.stringify(item))
	}
}

function getNonBreakableForFirstWord(prefix, text) {
	let pivot = text.indexOf(' ')
	if (pivot === -1) {
		pivot = text.length
	}
	return '<span class="nobr">' + prefix + text.substring(0, pivot) + '</span>' + text.substring(pivot)
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
