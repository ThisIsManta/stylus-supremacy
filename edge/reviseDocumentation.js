const fs = require('fs')
const _ = require('lodash')

const createFormattingOptions = require('./createFormattingOptions')
const createFormattingOptionsFromStylint = require('./createFormattingOptionsFromStylint')
const format = require('./format')
const stylintOptions = require('stylint/src/core/config')
const getCodeForFormatting = require('./getCodeForFormatting')

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
			`<section id="option-${_.kebabCase(name)}">`,
			`<h2>`,
			`<mark>${getBreakableLastWord(name)}</mark>`,
			`<wbr>`,
			`<code class="default-value">${getNonBreakableFirstWord('= ', JSON.stringify(item.default))}</code>`,
			`<wbr>`,
			`<code>${getNonBreakableFirstWord(': ', getType(item))}</code>`,
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
			}).join('') + '</table>',
			`</section>`
		])
		.flatten()
		.compact()
		.join('')
		.value()

	return defaultOptionJSON + formattingOptionDescription
}

function createStylintConversionTable() {
	const validFormattingOptionNames = Object.keys(createFormattingOptions.schema)

	const stylintOptionMap = _.toPairs(createFormattingOptionsFromStylint.map)
		.reduce((temp, pair) => {
			const stylintOptionName = pair[0]
			const formattingOptionNames = _.chunk(pair[1], 2)
				.map(item => item[0])
				.filter(item => validFormattingOptionNames.includes(item))

			temp[stylintOptionName] = formattingOptionNames
			return temp
		}, {})

	return _.map(stylintOptions, (item, name) =>
		'<tr>' +
		'<td><mark class="alt">' + getBreakableLastWord(name) + '</mark></td>' +
		'<td>' + (_.some(stylintOptionMap[name])
			? (stylintOptionMap[name].map(item => '<mark>' + getBreakableLastWord(item) + '</mark>').join(', '))
			: 'Not applicable') +
		'</td>' +
		'</tr>'
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

function getNonBreakableFirstWord(prefix, text) {
	let pivot = text.indexOf(' ')
	if (pivot === -1) {
		pivot = text.length
	}
	return '<span class="no-break">' + prefix + text.substring(0, pivot) + '</span>' + text.substring(pivot)
}

function getBreakableLastWord(text) {
	const pattern = _.camelCase(text)
	if (text === pattern) {
		return _.kebabCase(text)
			.split('-')
			.map((word, rank) => rank === 0 ? word : _.upperFirst(word))
			.join('<wbr>')

	} else {
		return text
	}
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
