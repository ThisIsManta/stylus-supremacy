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
	stringQuoteChar: false, // Specify falsy for not chaning the original quote
	// TODO: sortImports: 'alphabetical',
	sortProperties: 'alphabetical',
	alwaysUseImport: false,
	alwaysUseNot: false,
}

class StringBuffer {
	constructor() {
		this.buffer = []
	}

	append(text = '') {
		if (arguments.length > 1) {
			throw new Error('Found exceed arguments')
		}
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
				this.buffer[this.buffer.length - 1] = _.last(this.buffer).substring(0, _.last(this.buffer).length - text.length)
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

	const newLineBetweenGroups = _.repeat(options.newLineChar, options.insertNewLineBetweenGroups)

	const warnings = []

	const lines = content.split('\n')
	lines.between = function (startLineIndex, startColumnIndex, endLineIndex, endColumnIndex) {
		if (startLineIndex === endLineIndex) {
			return lines[startLineIndex].substring(startColumnIndex, endColumnIndex)

		} else {
			let buffer = [lines[startLineIndex].substring(startColumnIndex)]
			if (endLineIndex >= this.length) {
				endLineIndex = this.length - 1
			}
			while (++startLineIndex < this.length && startLineIndex < endLineIndex) {
				buffer.push(lines[startLineIndex])
			}
			buffer.push(lines[endLineIndex].substring(0, endColumnIndex))
			return buffer.join('\n')
		}
	}

	const rootNode = new stylus.Parser(content).parse()

	if (isDebugging) {
		console.log(JSON.stringify(rootNode, null, '\t'))
	}

	const outputBuffer = new StringBuffer(options)

	function travel(parentNode, inputNode, indentLevel, insideExpression = false, data = {}) {
		inputNode.parent = parentNode

		const outputBuffer = new StringBuffer()
		const indent = _.repeat(options.indentChar, indentLevel)

		// Insert sticky comment(s) before the current node
		if (inputNode.commentsOnTop) {
			outputBuffer.append(inputNode.commentsOnTop.map(node => travel(inputNode.parent, node, indentLevel)))
		}

		if (inputNode instanceof stylus.nodes.Import) {
			outputBuffer.append(indent + `@${options.alwaysUseImport || inputNode.once === false ? 'import' : 'require'} '${inputNode.path.nodes[0].val}'`)

			if (options.insertSemicolons) {
				outputBuffer.append(';')
			}
			outputBuffer.append(options.newLineChar)

		} else if (inputNode instanceof stylus.nodes.Group) {
			// outputBuffer.append(newLineBetweenGroups)

			// Insert single-line comment(s)
			const topCommentNodes = tryGetSingleLineCommentNodesOnTheTopOf(_.first(inputNode.nodes))
			if (topCommentNodes.length > 0) {
				outputBuffer.append(topCommentNodes.map(node => travel(inputNode.parent, node, indentLevel)))
			}

			// Insert CSS selector(s)
			const separator = ',' + (options.insertNewLineBetweenSelectors ? (options.newLineChar + indent) : ' ')
			outputBuffer.append(indent + inputNode.nodes.map(node => travel(inputNode, node, indentLevel, true)).join(separator).trim())

			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false, { potentialCommentNodeInsideTheBlock: _.last(inputNode.nodes) }))

		} else if (inputNode instanceof stylus.nodes.Root || inputNode instanceof stylus.nodes.Block) {
			const childIndentLevel = inputNode instanceof stylus.nodes.Root ? 0 : (indentLevel + 1)

			if (inputNode instanceof stylus.nodes.Block && options.insertBraces) {
				outputBuffer.append(' {')
			}

			// Insert a comment on the right of the last selector
			const sideCommentNode = tryGetMultiLineCommentNodeOnTheRightOf(data.potentialCommentNodeInsideTheBlock) || tryGetSingleLineCommentNodeOnTheRightOf(data.potentialCommentNodeInsideTheBlock)
			if (sideCommentNode) {
				if (options.insertSpaceBeforeComments) {
					outputBuffer.append(' ')
				}
				outputBuffer.append(travel(inputNode.parent, sideCommentNode, indentLevel, true))
			}

			outputBuffer.append(options.newLineChar)

			// Filter multi-line comment(s)
			const commentNodes = inputNode.nodes.filter(node => node instanceof stylus.nodes.Comment)

			const groups = []
			_.difference(inputNode.nodes, commentNodes).forEach((node, rank, list) => {
				if (rank > 0 && node.toJSON().__type === list[rank - 1].toJSON().__type && (node instanceof stylus.nodes.Group) === false) {
					_.last(groups).push(node)
				} else {
					groups.push([node])
				}
			})

			// Sort CSS properties
			groups.filter(group => group[0] instanceof stylus.nodes.Property).forEach(group => {
				let newGroup = group
				if (options.sortProperties === 'alphabetical') {
					newGroup = _.sortBy(group, node => node.segments.map(segment => segment.name).join(''))
				} else if (options.sortProperties === 'grouped') {
					newGroup = _.sortBy(group, node => {
						const propertyName = node.segments.map(segment => segment.name).join('')
						const propertyRank = ordering.grouped.indexOf(propertyName)
						if (propertyRank >= 0) {
							return propertyRank
						} else {
							return Infinity
						}
					})
				}

				groups[groups.indexOf(group)] = newGroup
			})

			// Note that do not mutate this
			const nonCommentNodes = _.flatten(groups)

			// Put single-line comment(s) to the relevant node
			nonCommentNodes.forEach(node => {
				node.commentsOnTop = tryGetSingleLineCommentNodesOnTheTopOf(node)

				const rightCommentNode = tryGetSingleLineCommentNodeOnTheRightOf(node)
				if (rightCommentNode) {
					if (node.commentsOnRight === undefined) {
						node.commentsOnRight = []
					}
					node.commentsOnRight.push(rightCommentNode)
				}
			})

			// Put a sticky multi-line comment to the relevant node
			_.orderBy(commentNodes, ['lineno', 'column'], ['desc', 'asc']).forEach(comment => {
				const sideNode = nonCommentNodes.find(node => node.lineno === comment.lineno && node.column < comment.column)
				if (sideNode) {
					if (sideNode.commentsOnRight === undefined) {
						sideNode.commentsOnRight = []
					}
					sideNode.commentsOnRight.push(comment)

				} else {
					const index = inputNode.nodes.indexOf(comment)
					if (index === inputNode.nodes.length - 1) {
						groups.push([comment])

					} else {
						let belowNode = inputNode.nodes[index + 1]
						if (_.includes(nonCommentNodes, belowNode)) {
							if (belowNode.commentsOnTop === undefined) {
								belowNode.commentsOnTop = []
							}
							belowNode.commentsOnTop.push(comment)

						} else if (belowNode instanceof stylus.nodes.Comment) {
							belowNode = nonCommentNodes.find(node => node.commentsOnTop && node.commentsOnTop.find(node => belowNode === node))
							belowNode.commentsOnTop.unshift(comment)
						}
					}
				}
			})

			// Insert CSS body
			outputBuffer.append(groups.map(group =>
				group.map(node =>
					travel(inputNode, node, childIndentLevel)
				).join('')
			).join(options.insertNewLineBetweenGroups ? options.newLineChar : ''))

			// Insert the bottom comment(s)
			const bottomCommentNodes = tryGetSingleLineCommentNodesOnTheBottomOf(_.last(nonCommentNodes))
			if (bottomCommentNodes) {
				outputBuffer.append(bottomCommentNodes.map(node => travel(inputNode.parent, node, childIndentLevel)))
			}

			if (inputNode instanceof stylus.nodes.Block && options.insertBraces) {
				outputBuffer.append(indent + '}').append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Selector) {
			outputBuffer.append(inputNode.segments.map(segment => travel(inputNode, segment, indentLevel, true)))

		} else if (inputNode instanceof stylus.nodes.Property) {
			// Insert the property name
			outputBuffer.append(indent + inputNode.segments.map(segment => travel(inputNode, segment, indentLevel, true)).join(''))

			if (options.insertColons) {
				outputBuffer.append(':')
			}
			outputBuffer.append(' ')

			// Insert the property value(s)
			if (inputNode.expr instanceof stylus.nodes.Expression) {
				// Extract the last portion of comments
				const lastComments = _.chain(inputNode.expr.nodes).clone().reverse().takeWhile(node => node instanceof stylus.nodes.Comment).reverse().value()
				const nodesExcludingLastComments = inputNode.expr.nodes.slice(0, inputNode.expr.nodes.length - lastComments.length)

				// Insert the property value(s) without the last portion of comments
				// Hence it will be, for example,
				// margin: 8px /* middle-comment */ 0; /* last-comment */
				outputBuffer.append(nodesExcludingLastComments.map(node => travel(inputNode, node, indentLevel, true)).join(' '))

				// Put the last portion of comments aside
				if (lastComments.length > 0) {
					if (inputNode.commentsOnRight === undefined) {
						inputNode.commentsOnRight = []
					}
					inputNode.commentsOnRight = inputNode.commentsOnRight.concat(lastComments)
				}
			} else {
				warnings.push({ message: 'Found unknown object', data: inputNode })
			}

			if (options.insertSemicolons) {
				outputBuffer.append(';')
			}

			/*const commentNode = tryGetCommentNodeOnTheRightOf(inputNode)
			if (commentNode) {
				if (options.insertSpaceBeforeComments) {
					outputBuffer.append(' ')
				}
				outputBuffer.append(travel(commentNode, indentLevel, true))
			}*/

			outputBuffer.append(options.newLineChar)

		} else if (inputNode instanceof stylus.nodes.Literal) {
			outputBuffer.append(inputNode.val)

		} else if (inputNode instanceof stylus.nodes.String) {
			outputBuffer.append(options.stringQuoteChar || inputNode.quote).append(inputNode.val).append(options.stringQuoteChar || inputNode.quote)

		} else if (inputNode instanceof stylus.nodes.Ident) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			outputBuffer.append(inputNode.name)

			if (_.isObject(inputNode.val)) {
				inputNode.val.parent = inputNode

				if (inputNode.val instanceof stylus.nodes.Function) {
					inputNode.val.params.parent = inputNode.val

					outputBuffer.append('(' + inputNode.val.params.nodes.map(node => travel(inputNode.val.params, node, indentLevel, true)).join(', ') + ')')
					outputBuffer.append(travel(inputNode.val, inputNode.val.block, indentLevel, false, { potentialCommentNodeInsideTheBlock: _.last(inputNode.val.params.nodes) }))
					outputBuffer.remove(options.newLineChar)

				} else if (inputNode.val instanceof stylus.nodes.Expression) {
					outputBuffer.append(' = ')
					outputBuffer.append(inputNode.val.nodes.map(node => travel(inputNode.val, node, indentLevel, true)).join(' '))
				}
			}

			if (insideExpression === false) {
				if (options.insertSemicolons && !(inputNode.val instanceof stylus.nodes.Function)) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Call) {
			inputNode.args.parent = inputNode

			outputBuffer.append(inputNode.name)
			outputBuffer.append('(' + inputNode.args.nodes.map(node => travel(inputNode.args, node, indentLevel, true)).join(', ') + ')')

		} else if (inputNode instanceof stylus.nodes.Expression) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			const parentIsASelector = inputNode.parent instanceof stylus.nodes.Selector
			if (parentIsASelector) {
				outputBuffer.append('{')
			}

			const currentIsAPartOfPropertyNames = !!travelUpUntil(inputNode, node => node instanceof stylus.nodes.Property && node.segments.includes(inputNode))
			outputBuffer.append(inputNode.nodes.map(node => {
				if (node instanceof stylus.nodes.Ident && (currentIsAPartOfPropertyNames || insideExpression === false)) {
					return '{' + travel(inputNode, node, indentLevel, true) + '}'
				} else {
					return travel(inputNode, node, indentLevel, true)
				}
			}).join(' '))

			if (parentIsASelector) {
				outputBuffer.append('}')
			}

			if (insideExpression === false) {
				if (options.insertSemicolons) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Unit) {
			outputBuffer.append(inputNode.val).append(inputNode.type)

		} else if (inputNode instanceof stylus.nodes.UnaryOp) {
			outputBuffer.append(inputNode.op === '!' && options.alwaysUseNot ? 'not ' : inputNode.op).append(travel(inputNode, inputNode.expr, indentLevel, true))

		} else if (inputNode instanceof stylus.nodes.BinOp) {
			if (inputNode.op === '[]') {
				outputBuffer.append(travel(inputNode, inputNode.left, indentLevel, true) + '[' + travel(inputNode, inputNode.right, indentLevel, true) + ']')

			} else if (inputNode.op === '...') {
				outputBuffer.append(travel(inputNode, inputNode.left, indentLevel, true) + '...' + travel(inputNode, inputNode.right, indentLevel, true))

			} else {
				outputBuffer.append(travel(inputNode, inputNode.left, indentLevel, true) + ' ' + inputNode.op)
				if (inputNode.right) {
					outputBuffer.append(' ' + travel(inputNode, inputNode.right, indentLevel, true))
				}
			}

		} else if (inputNode instanceof stylus.nodes.Ternary) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			if (insideExpression === false && inputNode.cond instanceof stylus.nodes.BinOp && inputNode.cond.op === 'is defined') {
				inputNode.cond.parent = inputNode

				outputBuffer.append(inputNode.cond.left.name)
				outputBuffer.append(' ?= ')
				outputBuffer.append(travel(inputNode.cond, inputNode.cond.left.val, indentLevel, true))

			} else {
				outputBuffer.append(travel(inputNode, inputNode.cond, indentLevel, true))
				outputBuffer.append(' ? ')
				outputBuffer.append(travel(inputNode, inputNode.trueExpr, indentLevel, true))
				outputBuffer.append(' : ')
				outputBuffer.append(travel(inputNode, inputNode.falseExpr, indentLevel, true))
			}

			if (insideExpression === false) {
				if (options.insertSemicolons) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Boolean) {
			outputBuffer.append(inputNode.val.toString())

		} else if (inputNode instanceof stylus.nodes.RGBA) {
			outputBuffer.append(inputNode.raw.trim())

		} else if (inputNode instanceof stylus.nodes.Comment && inputNode.str.startsWith('//')) { // In case of single-line comment
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}
			outputBuffer.append('//' + (options.insertSpaceAfterComments ? ' ' : '') + inputNode.str.substring(2).trim())
			if (insideExpression === false) {
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Comment && inputNode.str.startsWith('/*')) { // In case of multi-line comment
			const spaceAfterComment = (options.insertSpaceAfterComments ? ' ' : '')

			// Split into an array of lines
			let commentLines = inputNode.str.split(/\r?\n/).map(line => line.trim())

			if (commentLines.length === 1) { // In case of one line only
				// Add a white-space between /* and */
				commentLines[0] = '/*' + spaceAfterComment + commentLines[0].substring(2, commentLines[0].length - 2).trim() + spaceAfterComment + '*/'

			} else { // In case of more than one line
				const documenting = _.first(commentLines).startsWith('/**')

				// Add a white-space after /*
				if (_.first(commentLines) !== '/*' && documenting === false) {
					commentLines[0] = '/*' + spaceAfterComment + _.first(commentLines).substring(2).trim()
				}

				// Add indentation to in-between lines
				let zeroBasedLineIndex = 0
				while (++zeroBasedLineIndex <= commentLines.length - 2) {
					if (documenting) {
						if (commentLines[zeroBasedLineIndex].startsWith('*')) {
							if (commentLines[zeroBasedLineIndex].substring(1).charAt(0) === ' ') {
								commentLines[zeroBasedLineIndex] = ' *' + commentLines[zeroBasedLineIndex].substring(1)
							} else {
								commentLines[zeroBasedLineIndex] = ' *' + spaceAfterComment + commentLines[zeroBasedLineIndex].substring(1)
							}
						} else {
							commentLines[zeroBasedLineIndex] = ' *' + spaceAfterComment + commentLines[zeroBasedLineIndex]
						}
					} else {
						commentLines[zeroBasedLineIndex] = '  ' + spaceAfterComment + commentLines[zeroBasedLineIndex]
					}
				}

				// Add a white-space before */
				if (_.last(commentLines) === '*/') {
					if (documenting) {
						commentLines[commentLines.length - 1] = ' ' + _.last(commentLines)
					}
				} else {
					commentLines[commentLines.length - 1] = '   ' + _.trimEnd(_.last(commentLines).substring(0, _.last(commentLines).length - 2)) + spaceAfterComment + '*/'
				}
			}

			if (insideExpression) {
				// For example,
				// margin: 8px /* standard */ 0;
				outputBuffer.append(commentLines.join(options.newLineChar))

			} else {
				outputBuffer.append(commentLines.map(line => indent + line).join(options.newLineChar)).append(options.newLineChar)
			}

		} else if (typeof inputNode === 'string') {
			outputBuffer.append(inputNode)

		} else {
			warnings.push({ message: 'Found unknown object', data: inputNode })
		}

		if (inputNode.commentsOnRight) {
			outputBuffer.remove(options.newLineChar)
			if (options.insertSpaceBeforeComments) {
				outputBuffer.append(' ')
			}
			outputBuffer.append(inputNode.commentsOnRight.map(node => travel(inputNode.parent, node, indentLevel, true)))
			outputBuffer.append(options.newLineChar)
		}

		return outputBuffer.toString()
	}

	function tryGetSingleLineCommentNodesOnTheTopOf(inputNode) {
		// Skip operation for `Group` type
		if (inputNode instanceof stylus.nodes.Group) {
			return []
		}

		const commentNodes = []
		let zeroBasedLineIndex = inputNode.lineno - 1
		while (--zeroBasedLineIndex >= 0 && lines[zeroBasedLineIndex].trim().startsWith('//')) {
			commentNodes.unshift(new stylus.nodes.Comment(lines[zeroBasedLineIndex].trim(), false, false))
		}
		return commentNodes
	}

	function tryGetSingleLineCommentNodesOnTheBottomOf(inputNode) {
		if (!inputNode) {
			return null
		}

		// Skip operation for `Group` type
		if (inputNode instanceof stylus.nodes.Group) {
			return null
		}

		const commentNodes = []
		let zeroBasedLineIndex = inputNode.lineno - 1
		const sourceNodeIndent = lines[zeroBasedLineIndex].substring(0, lines[zeroBasedLineIndex].length - _.trimStart(lines[zeroBasedLineIndex]).length)
		while (++zeroBasedLineIndex < lines.length && lines[zeroBasedLineIndex].trim().startsWith('//') && lines[zeroBasedLineIndex].startsWith(sourceNodeIndent)) {
			commentNodes.push(new stylus.nodes.Comment(lines[zeroBasedLineIndex].trim(), false, false))
		}
		return commentNodes
	}

	function tryGetSingleLineCommentNodeOnTheRightOf(inputNode) {
		if (!inputNode || lines[inputNode.lineno - 1].substring(inputNode.column - 1).includes('//') === false) {
			return null
		}

		// Skip operation for `Group` type
		if (inputNode instanceof stylus.nodes.Group) {
			return null
		}

		let zeroBasedLineIndex = inputNode.lineno - 1
		let sideCommentText = lines[zeroBasedLineIndex]
		sideCommentText = sideCommentText.substring(sideCommentText.indexOf('//', inputNode.column)).trim()
		return new stylus.nodes.Comment(sideCommentText, false, false)
	}

	function tryGetMultiLineCommentNodeOnTheRightOf(inputNode) {
		if (!inputNode || lines[inputNode.lineno - 1].substring(inputNode.column - 1).includes('/*') === false) {
			return null
		}

		let zeroBasedLineIndex = inputNode.lineno - 1
		let sideCommentText = lines[zeroBasedLineIndex]
		sideCommentText = sideCommentText.substring(sideCommentText.indexOf('/*', inputNode.column))
		if (sideCommentText.includes('*/')) {
			sideCommentText = sideCommentText.substring(0, sideCommentText.indexOf('*/') + 2)
		} else {
			while (++zeroBasedLineIndex < lines.length) {
				if (sideCommentText.includes('*/')) {
					sideCommentText = sideCommentText.substring(0, sideCommentText.indexOf('*/') + 2)
					break
				} else {
					sideCommentText += options.newLineChar
					sideCommentText += lines[zeroBasedLineIndex]
				}
			}
		}
		return new stylus.nodes.Comment(sideCommentText, false, false)
	}

	function travelUpUntil(inputNode, condition) {
		const workingNode = inputNode && inputNode.parent
		if (!workingNode) {
			return null
		} else if (condition(workingNode)) {
			return workingNode
		} else {
			return travelUpUntil(workingNode, condition)
		}
	}

	let output = travel(null, rootNode, 0)
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