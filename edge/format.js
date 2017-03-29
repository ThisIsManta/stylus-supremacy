const os = require('os')
const stylus = require('stylus')
const ordering = require('stylint/src/data/ordering.json')
const _ = require('lodash')

const defaultFormattingOptions = {
	insertColons: true,
	insertSemicolons: true,
	insertBraces: true,
	insertNewLineBetweenGroups: 1,
	insertNewLineBetweenSelectors: false,
	insertSpaceBeforeComments: true,
	insertSpaceAfterComments: true,
	indentChar: '\t',
	newLineChar: os.EOL,
	sortProperties: 'alphabetical',
	preferImport: false,
}

class StringBuffer {
	constructor() {
		this.buffer = []
	}

	append(text = '') {
		if (_.isArray(text)) {
			this.buffer = this.buffer.concat(text)
		} else {
			this.buffer.push(text)
		}
		return this
	}

	remove(text) {
		if (text === undefined) {
			this.buffer.pop()
		} else if (this.buffer.length > 0) {
			if (_.last(this.buffer) === text) {
				this.buffer.pop()
			} else if (_.last(this.buffer).endsWith(text)) {
				this.buffer[this.buffer.length - 1] = _.last(this.buffer).substring(_.last(this.buffer).length - text.length)
			}
		}
		return this
	}

	toString() {
		return this.buffer.join('')
	}
}

function format(content, options, isDebugging = false) {
	options = _.assign({}, defaultFormattingOptions, options)

	const warnings = []

	const lines = content.split('\n')

	const rootNode = new stylus.Parser(content).parse()

	if (isDebugging) {
		console.log(JSON.stringify(rootNode, null, '\t'))
	}

	const outputBuffer = new StringBuffer(options)

	function travel(inputNode, levelCount, insideExpression = false) {
		const outputBuffer = new StringBuffer()
		const indent = _.repeat(options.indentChar, levelCount)

		if (inputNode.commentsOnTop) {
			outputBuffer.append(inputNode.commentsOnTop.map(comment => travel(comment, levelCount)))
		}

		if (inputNode instanceof stylus.nodes.Root) {
			outputBuffer.append(inputNode.nodes.map(node => travel(node, levelCount)))

		} else if (inputNode instanceof stylus.nodes.Import) {
			outputBuffer.append(indent + `@${options.preferImport || inputNode.once === false ? 'import' : 'require'} '${inputNode.path.nodes[0].val}'`)

			if (options.insertSemicolons) {
				outputBuffer.append(';')
			}
			outputBuffer.append(options.newLineChar)

		} else if (inputNode instanceof stylus.nodes.Group) {
			if (options.insertNewLineBetweenGroups > 0) {
				outputBuffer.append(_.repeat(options.newLineChar, options.insertNewLineBetweenGroups))
			}

			const commentsOnTop = []
			let zeroBasedLineIndex = _.first(inputNode.nodes).lineno - 1
			while (--zeroBasedLineIndex >= 0 && lines[zeroBasedLineIndex].trim().startsWith('//')) {
				commentsOnTop.unshift(indent + '//' + (options.insertSpaceAfterComments ? ' ' : '') + lines[zeroBasedLineIndex].trim().substring(2).trim() + options.newLineChar)
			}
			outputBuffer.append(commentsOnTop)

			const separator = ',' + (options.insertNewLineBetweenSelectors ? (options.newLineChar + indent) : ' ')

			outputBuffer.append(indent + inputNode.nodes.map(node => travel(node, levelCount, true)).join(separator).trim())

			if (options.insertBraces) {
				outputBuffer.append(' {')
			}

			if (lines[_.last(inputNode.nodes).lineno - 1].trim().includes('//')) {
				const line = lines[_.last(inputNode.nodes).lineno - 1]
				if (options.insertSpaceBeforeComments) {
					outputBuffer.append(' ')
				}
				outputBuffer.append('//')
				if (options.insertSpaceAfterComments) {
					outputBuffer.append(' ')
				}
				outputBuffer.append(line.substring(line.indexOf('//') + 2).trim())
			}

			outputBuffer.append(options.newLineChar)

			let properties = inputNode.block.nodes.filter(node => node instanceof stylus.nodes.Property)

			if (options.sortProperties === 'alphabetical') {
				properties = _.sortBy(properties, node => node.segments.map(segment => segment.name).join(''))

			} else if (options.sortProperties === 'grouped') {
				properties = _.sortBy(properties, node => {
					const propertyName = node.segments.map(segment => segment.name).join('')
					const propertyRank = ordering.grouped.indexOf(propertyName)
					if (propertyRank >= 0) {
						return propertyRank
					} else {
						return Infinity
					}
				})
			}

			const comments = inputNode.block.nodes.filter(node => node instanceof stylus.nodes.Comment)

			let sortedNodes = properties.concat(_.difference(inputNode.block.nodes, properties, comments))

			_.chain(comments).orderBy(['lineno', 'column'], ['desc', 'asc']).forEach(comment => {
				const sideNode = sortedNodes.find(node => node.lineno === comment.lineno && node.column < comment.column)
				if (sideNode) {
					if (sideNode.commentsOnRight === undefined) {
						sideNode.commentsOnRight = []
					}
					sideNode.commentsOnRight.push(comment)

				} else {
					const index = inputNode.block.nodes.indexOf(comment)
					if (index === inputNode.block.nodes.length - 1) {
						sortedNodes.push(index)

					} else {
						let belowNode = inputNode.block.nodes[index + 1]
						if (_.includes(sortedNodes, belowNode)) {
							if (belowNode.commentsOnTop === undefined) {
								belowNode.commentsOnTop = []
							}
							belowNode.commentsOnTop.push(comment)

						} else if (belowNode instanceof stylus.nodes.Comment) {
							belowNode = sortedNodes.find(node => node.commentsOnTop && node.commentsOnTop.find(node => belowNode === node))
							belowNode.commentsOnTop.unshift(comment)
						}
					}
				}
			}).value()

			outputBuffer.append(sortedNodes.map(node => travel(node, levelCount + 1)).join(''))

			if (options.insertBraces) {
				outputBuffer.append(indent + '}').append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Selector) {
			outputBuffer.append(inputNode.segments.map(segment => segment.string))

		} else if (inputNode instanceof stylus.nodes.Property) {
			const separator = (options.insertSemicolons ? ';' : '') + options.newLineChar + indent

			outputBuffer.append(indent + inputNode.segments.map(segment => {
				return segment.name
			}).join(' '))

			if (options.insertColons) {
				outputBuffer.append(':')
			}
			outputBuffer.append(' ')

			if (inputNode.expr instanceof stylus.nodes.Expression) {
				outputBuffer.append(inputNode.expr.nodes.map(node => travel(node, levelCount, true)).join(' '))
			} else {
				warnings.push({ message: 'Found unknown object', data: inputNode })
			}

			if (options.insertSemicolons) {
				outputBuffer.append(';')
			}
			outputBuffer.append(options.newLineChar)

		} else if (inputNode instanceof stylus.nodes.Ident) {
			outputBuffer.append(inputNode.name)

		} else if (inputNode instanceof stylus.nodes.Unit) {
			outputBuffer.append(inputNode.val).append(inputNode.type)

		} else if (inputNode instanceof stylus.nodes.Call) {
			outputBuffer.append(inputNode.name).append('(' + inputNode.args.nodes.map(node => travel(node, levelCount)).join(', ') + ')')

		} else if (inputNode instanceof stylus.nodes.Expression) {
			outputBuffer.append(inputNode.nodes.map(node => travel(node, levelCount)).join(' '))

		} else if (inputNode instanceof stylus.nodes.Comment) {
			const spaceOrNothing = (options.insertSpaceAfterComments ? ' ' : '')

			let commentLines = inputNode.str.split(/\r?\n/).map(line => line.trim())
			if (commentLines.length === 1) {
				commentLines[0] = '/*' + spaceOrNothing + commentLines[0].substring(2, commentLines[0].length - 2).trim() + spaceOrNothing + '*/'

			} else {
				const documenting = _.first(commentLines).startsWith('/**')

				if (_.first(commentLines) !== '/*' && documenting === false) {
					commentLines[0] = '/*' + spaceOrNothing + _.first(commentLines).substring(2).trim()
				}

				let zeroBasedLineIndex = 0
				while (++zeroBasedLineIndex <= commentLines.length - 2) {
					if (documenting) {
						if (commentLines[zeroBasedLineIndex].startsWith('*')) {
							if (commentLines[zeroBasedLineIndex].substring(1).charAt(0) === ' ') {
								commentLines[zeroBasedLineIndex] = ' *' + commentLines[zeroBasedLineIndex].substring(1)
							} else {
								commentLines[zeroBasedLineIndex] = ' *' + spaceOrNothing + commentLines[zeroBasedLineIndex].substring(1)
							}
						} else {
							commentLines[zeroBasedLineIndex] = ' *' + spaceOrNothing + commentLines[zeroBasedLineIndex]
						}
					} else {
						commentLines[zeroBasedLineIndex] = '  ' + commentLines[zeroBasedLineIndex]
					}
				}

				if (_.last(commentLines) === '*/') {
					if (documenting) {
						commentLines[commentLines.length - 1] = ' ' + _.last(commentLines)
					}
				} else {
					commentLines[commentLines.length - 1] = '   ' + _.trimEnd(_.last(commentLines).substring(0, _.last(commentLines).length - 2)) + spaceOrNothing + '*/'
				}
			}

			if (insideExpression) {
				outputBuffer.append(commentLines.join(options.newLineChar))

			} else {
				outputBuffer.append(commentLines.map(line => indent + line).join(options.newLineChar)).append(options.newLineChar)
			}

		} else {
			warnings.push({ message: 'Found unknown object', data: inputNode })
		}

		if (inputNode.commentsOnRight) {
			outputBuffer.remove(options.newLineChar)
			outputBuffer.append(inputNode.commentsOnRight.map(comment => ' ' + comment.str))
			outputBuffer.append(options.newLineChar)
		}

		return outputBuffer.toString()
	}

	let output = travel(rootNode, 0)
	if (output.startsWith(options.newLineChar)) {
		output = output.substring(options.newLineChar.length)
	}
	if (output.endsWith(options.newLineChar) && content.includes('\n') && content.substring(content.lastIndexOf('\n') + 1).trim().length > 0) {
		output = output.substring(0, output.length - options.newLineChar.length)
	}

	return {
		content: output,
		warnings,
	}
}

module.exports.format = format