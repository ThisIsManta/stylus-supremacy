const fs = require('fs')
const YAML = require('js-yaml')
const isEmpty = require('lodash/isEmpty')
const isObject = require('lodash/isObject')
const omitBy = require('lodash/omitBy')
const uniq = require('lodash/uniq')
const chunk = require('lodash/chunk')
const sortBy = require('lodash/sortBy')
const intersection = require('lodash/intersection')
const escape = require('lodash/escape')
const kebabCase = require('lodash/kebabCase')
const camelCase = require('lodash/camelCase')
const upperFirst = require('lodash/upperFirst')

const schema = require('./schema')
const createFormattingOptions = require('./createFormattingOptions')
const createFormattingOptionsFromStylint = require('./createFormattingOptionsFromStylint')
const format = require('./format')
const stylintOptions = require('stylint/src/core/config')
const createCodeForFormatting = require('./createCodeForFormatting')
const createCodeForHTML = require('./createCodeForHTML')

let document = fs.readFileSync('docs/index.html', 'utf-8')
document = updateDocument(document, '<!-- formatting toggler placeholder -->', createFormattingTogglersForDemo)
document = updateDocument(document, '<!-- formatting option placeholder -->', createFormattingDescription)
document = updateDocument(document, '<!-- stylint option placeholder -->', createStylintConversionTable)
document = updateDocument(document, '<!-- pre-commit-config -->', createPreCommitConfigSample)

fs.writeFileSync('docs/index.html', document)

function updateDocument(document, placeholder, worker) {
	const chunks = document.split(placeholder)
	const output = worker()
	return chunks[0] + placeholder + output + placeholder + chunks[chunks.length - 1]
}

function createFormattingTogglersForDemo() {
	return Object.entries(schema)
		.filter(([name, item]) => !item.hideInDemo)
		.map(([name, item]) => {
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

			} else if (item.enum !== undefined) {
				return (
					`<label for="demo-${name}">` +
					`<span>${name}</span>` +
					`<select id="demo-${name}" value="${getType(item.default)}">` +
					renderOptions(item.enum) +
					`</select>` +
					`</label>`
				)

			} else if (item.oneOf !== undefined) {
				return (
					`<label for="demo-${name}">` +
					`<span>${name}</span>` +
					`<select id="demo-${name}" value="${getType(item.default)}">` +
					item.oneOf.map(stub => stub.enum
						? renderOptions(stub.enum)
						: `<option value="${getType(stub)}" ${isObject(stub) ? 'disabled' : ''}>${getType(stub)}</option>`
					) +
					`</select>` +
					`</label>`
				)
			}
		})
		.join('')
}

function renderOptions(items) {
	return items.map(stub => `<option value="${getType(stub)}">${getType(stub)}</option>`).join('')
}

function createFormattingDescription() {
	const defaultOptionJSON = createCodeForHTML(JSON.stringify(omitBy(createFormattingOptions(), (item, name) => schema[name].deprecated), null, '  '))

	const defaultOptionHTML = (
		'<code>' +
		defaultOptionJSON
			.replace(/<br>/g, '\n')
			.replace(/^&nbsp;&nbsp;&quot;(\w+)&quot;/gm, (full, part) => full.replace(part, `<a href="#option-${kebabCase(part)}">stylusSupremacy.${createBreakableWords(part)}</a>`))
			.replace(/\n/g, '<br>') +
		'</code>'
	)

	const formattingOptionDescription = Object.entries(schema)
		.flatMap(([name, item]) => [
			`<section id="option-${kebabCase(name)}">`,
			`<h2 class="${item.deprecated ? 'deprecated' : ''}">`,
			item.deprecated && '<b>DEPRECATED </b>',
			`<mark>${createBreakableWords(name)}</mark>`,
			`<wbr>`,
			`<code class="default-value">${createNonBreakableForFirstWord('= ', JSON.stringify(item.default))}</code>`,
			`<wbr>`,
			`<code>${createNonBreakableForFirstWord(': ', getType(item))}</code>`,
			`</h2>`,
			item.description && item.description.split('\n').map(line => `<p>${line}</p>`).join(''),
			item.hideInVSCE ? '<p>This option is not available in the Visual Studio Code extension.</p>' : '',
			item.example && chunk(item.example.values, 2).map(values =>
				createResponsiveTable(
					values.map(value => JSON.stringify(value, null, '\t').replace(/(\[|\{)\n\t+/g, '[').replace(/^\t+/gm, ' ').replace(/\n/g, '')),
					values.map(value => createCodeForHTML(format(createCodeForFormatting(item.example.code), { [name]: value })))
				)
			).join('') +
			`</section>`
		])
		.filter(line => !!line)
		.join('')

	return defaultOptionHTML + formattingOptionDescription
}

function createStylintConversionTable() {
	const validFormattingOptionNames = Object.keys(schema)

	const stylintOptionMap = Object.entries(createFormattingOptionsFromStylint.map)
		.reduce((temp, [stylintOptionName, conversionRules]) => {
			const formattingOptionNames = intersection(
				chunk(conversionRules, 2)
					.map(([formattingOptionName]) => formattingOptionName),
				validFormattingOptionNames
			)

			temp[stylintOptionName] = formattingOptionNames
			return temp
		}, {})

	const stylintOptionNames = sortBy(
		uniq(
			[stylintOptions, stylintOptionMap]
				.flatMap((item) => Object.keys(item))
		)
	)

	return '<tbody>' +
		stylintOptionNames.map(name =>
			'<tr>' +
			'<td><mark class="alt">' + createBreakableWords(name) + '</mark></td>' +
			'<td>' + (
				isEmpty(stylintOptionMap[name])
					? 'Not applicable'
					: stylintOptionMap[name].map(item => '<mark>' + createBreakableWords(item) + '</mark>').join(', ')
			) +
			'</td>' +
			'</tr>'
		).join('') +
		'</tbody>'
}

function getType(item) {
	if (isObject(item)) {
		if (item.type) {
			return item.type + (item.items ? ('&lt;' + getType(item.items) + '&gt;') : '')
		} else {
			return (item.enum || item.oneOf).map(item => getType(item)).join(' | ')
		}
	} else {
		return escape(JSON.stringify(item))
	}
}

function createNonBreakableForFirstWord(prefix, text) {
	let pivot = text.indexOf(' ')
	if (pivot === -1) {
		pivot = text.length
	}
	return '<span class="no-break">' + prefix + text.substring(0, pivot) + '</span>' + text.substring(pivot)
}

function createBreakableWords(text) {
	const pattern = camelCase(text)
	if (text === pattern) {
		return kebabCase(text)
			.split('-')
			.map((word, rank) => rank === 0 ? word : upperFirst(word))
			.join('<wbr>')

	} else {
		return text
	}
}

function createResponsiveTable(head, body) {
	return (
		'<div class="table">' +
		'<div class="table-head">' +
		head.map(cell =>
			'<div>' + cell + '</div>'
		).join('') +
		'</div>' +
		'<div class="table-body">' +
		body.map(cell =>
			'<div>' + cell + '</div>'
		).join('') +
		'</div>' +
		'</div>' +
		'<div class="table responsive">' +
		head.map((nope, rank) =>
			'<div class="table-head">' + '<div>' + head[rank] + '</div>' + '</div>' +
			'<div class="table-body">' + '<div>' + body[rank] + '</div>' + '</div>'
		).join('') +
		'</div>'
	)
}

function createPreCommitConfigSample() {
	const packageJSON = require('../package.json')
	const [{ id }] = YAML.load(fs.readFileSync('.pre-commit-hooks.yaml', 'utf-8'), { json: true })

	return '<code>' + escape(
		`
repos:
	- repo:
			${packageJSON.repository.url.replace(/\.git$/, '')}
		rev: v${packageJSON.version}
		hooks:
			- id: ${id}
				args: # Optional
					- '--options'
					- './path/to/your/options.json'
		`
	).trim().replace(/\t/g, '&nbsp;&nbsp;').replace(/\n/g, '<br>\n') + '</code>'
}
