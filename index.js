const ps = require('process')
const os = require('os')
const fs = require('fs')
const glob = require('glob')
const stylus = require('stylus')
const _ = require('lodash')

const defaultOptions = {
	insertColons: true,
	insertSemicolons: true,
	insertBraces: true,
	insertNewLineBetweenGroups: 1,
	insertNewLineBetweenSelectors: false,
	indentChar: '\t',
	newLineChar: os.EOL,
	sortOrder: 'alphabetical'
}

class StringBuffer {
	constructor(options) {
		this.buffer = []
		this.options = options
	}

	append(text = '') {
		this.buffer.push(text)
		return this
	}

	appendLine(text = '') {
		this.buffer.push(text + this.options.newLineChar)
		return this
	}

	toString() {
		return this.buffer.join('')
	}
}

function format(content, options) {
	options = _.assign({}, defaultOptions, options)

	const rootNode = new stylus.Parser(content).parse()

	console.log(JSON.stringify(rootNode, null, '  '))

	const outputBuffer = new StringBuffer()

	function travel(inputNode, levelCount) {
		const indent = _.repeat(options.indentChar, levelCount)

		if (inputNode.__type === 'Root') {
			inputNode.nodes.forEach(node => {
				travel(node, levelCount)
			})

		} else if (inputNode.__type === 'Group') {
			const separator = ',' + (options.insertNewLineBetweenSelectors ? (options.newLineChar + indent) : ' ')

			outputBuffer.append(indent + inputNode.nodes.map(node => {
				if (node.__type === 'Selector') {
					return node.segments.map(segment => segment.string).join('')
				} else {
					console.warn('Unknown:', node)
				}
			}).join(separator))

			if (options.insertBraces) {
				outputBuffer.appendLine(' {')
			}

			inputNode.block.nodes.forEach(node => {
				travel(node, levelCount + 1)
			})

			if (options.insertBraces) {
				outputBuffer.appendLine(indent + '}')
			}

		} else if (inputNode.__type === 'Property') {
			const separator = (options.insertSemicolons ? ';' : '') + options.newLineChar + indent

			outputBuffer.append(indent + inputNode.segments.map(segment => {
				return segment.name
			}).join(' '))

			if (options.insertColons) {
				outputBuffer.append(':')
			}
			outputBuffer.append(' ')

			if (inputNode.expr.__type === 'Expression') {
				outputBuffer.append(inputNode.expr.nodes.map(node => {
					return node.name
				}))
			} else {
				console.warn('Unknown:', inputNode.expr)
			}

			outputBuffer.appendLine()
		}
	}

	travel(rootNode, 0, outputBuffer)

	console.log('===', outputBuffer.toString())
}

function sortAttributes() {

}

module.exports.format = format